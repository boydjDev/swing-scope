use rusqlite::{Connection, Result};
use std::path::PathBuf;
use tauri::Manager;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use sha2::{Sha256, Digest};

#[derive(Debug, Serialize, Deserialize)]
pub struct Shot {
    pub club_type: String,
    pub club_brand: String,
    pub club_model: String,
    pub carry_distance: f64,
    pub total_distance: f64,
    pub ball_speed: f64,
    pub club_speed: f64,
    pub smash_factor: f64,
    pub launch_angle: f64,
    pub launch_direction: f64,
    pub apex: f64,
    pub side_carry: f64,
    pub descent_angle: f64,
    pub attack_angle: f64,
    pub club_path: f64,
    pub spin_rate: f64,
    pub spin_axis: f64,
    pub club_data_est: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: i64,
    pub profile_id: i64,
    pub player_name: String,
    pub date: String,
    pub source_filename: String,
    pub shot_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Profile {
    pub id: i64,
    pub name: String,
}


fn db_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir()
        .expect("could not find app data dir")
        .join("golf.db")
}

fn init_db(conn: &Connection) -> Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;

    if version < 4 {
        conn.execute_batch("
            DROP TABLE IF EXISTS shots;
            DROP TABLE IF EXISTS sessions;
        ")?;
        conn.execute_batch("PRAGMA user_version = 4")?;
    }

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER NOT NULL REFERENCES profiles(id),
            date TEXT NOT NULL,
            source_filename TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            UNIQUE(profile_id, content_hash)
        );

        CREATE TABLE IF NOT EXISTS shots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES sessions(id),
            club_type TEXT,
            club_brand TEXT,
            club_model TEXT,
            carry_distance REAL,
            total_distance REAL,
            ball_speed REAL,
            club_speed REAL,
            smash_factor REAL,
            launch_angle REAL,
            launch_direction REAL,
            apex REAL,
            side_carry REAL,
            descent_angle REAL,
            attack_angle REAL,
            club_path REAL,
            spin_rate REAL,
            spin_axis REAL,
            club_data_est INTEGER
        );
    ")
}

fn compute_file_hash(path: &str) -> std::result::Result<String, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn parse_rapsodo_csv(path: &str) -> std::result::Result<(String, Vec<Shot>), String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_reader(file);

    let rows: Vec<csv::StringRecord> = reader.records()
        .filter_map(|r| r.ok())
        .collect();

    if rows.is_empty() {
        return Err("File is empty".to_string());
    }

    // Detect format from first row: Rapsodo header or direct column headers
    let first_cell = rows[0].get(0).unwrap_or("").trim();

    let date = if first_cell.starts_with("Rapsodo") {
        // Format: "Rapsodo MLM2PRO: Name - MM/DD/YYYY H:MM AM/PM"
        let meta: Vec<&str> = first_cell.splitn(2, ':').collect();
        let after_colon = meta.get(1).unwrap_or(&"").trim();
        let parts: Vec<&str> = after_colon.splitn(2, " - ").collect();
        parts.get(1).unwrap_or(&"").trim().to_string()
    } else {
        // No metadata header (Practice/Courses) — parse date from filename
        // Filename pattern: mlm2pro_shotexport_MMDDYY.csv
        let stem = std::path::Path::new(path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        stem.strip_prefix("mlm2pro_shotexport_")
            .filter(|s| s.len() == 6)
            .map(|s| format!("{}/{}/20{}", &s[0..2], &s[2..4], &s[4..6]))
            .unwrap_or_else(|| "Unknown".to_string())
    };

    // Find the column header row and its index so data iteration starts exactly after it
    let header_idx = rows.iter().position(|r| {
        r.get(0).map(|v| v.trim() == "Club Type").unwrap_or(false)
    }).ok_or("Could not find header row")?;
    let header_row = &rows[header_idx];

    // Map column names to indices
    let headers: Vec<String> = header_row.iter()
        .map(|h| h.trim().to_string())
        .collect();

    let col = |name: &str| -> std::result::Result<usize, String> {
        headers.iter().position(|h| h == name)
            .ok_or(format!("Missing column: {}", name))
    };

    let idx_club_type        = col("Club Type")?;
    let idx_club_brand       = col("Club Brand")?;
    let idx_club_model       = col("Club Model")?;
    let idx_carry            = col("Carry Distance")?;
    let idx_total            = col("Total Distance")?;
    let idx_ball_speed       = col("Ball Speed")?;
    let idx_club_speed       = col("Club Speed")?;
    let idx_smash            = col("Smash Factor")?;
    let idx_launch_angle     = col("Launch Angle")?;
    let idx_launch_dir       = col("Launch Direction")?;
    let idx_apex             = col("Apex")?;
    let idx_side_carry       = col("Side Carry")?;
    let idx_descent          = col("Descent Angle")?;
    let idx_attack           = col("Attack Angle")?;
    let idx_club_path        = col("Club Path")?;
    let idx_spin_rate        = col("Spin Rate")?;
    let idx_spin_axis        = col("Spin Axis")?;
    let idx_est              = col("Club Data Est Type")?;

    let skip = ["Club Type", "Average", "Std. Dev.", ""];

    let mut shots = Vec::new();

    for row in &rows[header_idx + 1..] {
        let club_type = row.get(idx_club_type).unwrap_or("").trim();

        if skip.iter().any(|s| *s == club_type) {
            continue;
        }

        let parse_f64 = |idx: usize| -> f64 {
            row.get(idx)
                .unwrap_or("")
                .trim()
                .parse::<f64>()
                .unwrap_or(0.0)
        };

        let parse_i64 = |idx: usize| -> i64 {
            row.get(idx)
                .unwrap_or("")
                .trim()
                .parse::<f64>()
                .unwrap_or(0.0) as i64
        };

        shots.push(Shot {
            club_type:        club_type.to_string(),
            club_brand:       row.get(idx_club_brand).unwrap_or("").trim().to_string(),
            club_model:       row.get(idx_club_model).unwrap_or("").trim().to_string(),
            carry_distance:   parse_f64(idx_carry),
            total_distance:   parse_f64(idx_total),
            ball_speed:       parse_f64(idx_ball_speed),
            club_speed:       parse_f64(idx_club_speed),
            smash_factor:     parse_f64(idx_smash),
            launch_angle:     parse_f64(idx_launch_angle),
            launch_direction: parse_f64(idx_launch_dir),
            apex:             parse_f64(idx_apex),
            side_carry:       parse_f64(idx_side_carry),
            descent_angle:    parse_f64(idx_descent),
            attack_angle:     parse_f64(idx_attack),
            club_path:        parse_f64(idx_club_path),
            spin_rate:        parse_f64(idx_spin_rate),
            spin_axis:        parse_f64(idx_spin_axis),
            club_data_est:    parse_i64(idx_est),
        });
    }

    if shots.is_empty() {
        return Err("No valid shot data found".to_string());
    }

    Ok((date, shots))
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ImportStatus {
    Imported,
    Skipped,
    Error,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub filename: String,
    pub status: ImportStatus,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportSummary {
    pub results: Vec<ImportResult>,
    pub imported: usize,
    pub skipped: usize,
    pub errors: usize,
}

fn import_one(conn: &Connection, file_path: &str, profile_id: i64) -> ImportResult {
    let filename = std::path::Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let content_hash = match compute_file_hash(file_path) {
        Ok(h) => h,
        Err(e) => return ImportResult { filename, status: ImportStatus::Error, message: e },
    };

    let (date, shots) = match parse_rapsodo_csv(file_path) {
        Ok(v) => v,
        Err(e) => return ImportResult { filename, status: ImportStatus::Error, message: e },
    };

    let exists: bool = match conn.query_row(
        "SELECT COUNT(*) FROM sessions WHERE profile_id = ?1 AND content_hash = ?2",
        rusqlite::params![profile_id, content_hash],
        |row| row.get::<_, i64>(0),
    ) {
        Ok(n) => n > 0,
        Err(e) => return ImportResult { filename, status: ImportStatus::Error, message: e.to_string() },
    };

    if exists {
        return ImportResult {
            message: format!("'{}' already imported, skipped", filename),
            filename,
            status: ImportStatus::Skipped,
        };
    }

    let result = (|| -> std::result::Result<usize, String> {
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO sessions (profile_id, date, source_filename, content_hash) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![profile_id, date, filename, content_hash],
        ).map_err(|e| e.to_string())?;

        let session_id = tx.last_insert_rowid();

        for shot in &shots {
            tx.execute(
                "INSERT INTO shots (
                    session_id, club_type, club_brand, club_model,
                    carry_distance, total_distance, ball_speed, club_speed,
                    smash_factor, launch_angle, launch_direction, apex,
                    side_carry, descent_angle, attack_angle, club_path,
                    spin_rate, spin_axis, club_data_est
                ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                    ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19
                )",
                rusqlite::params![
                    session_id,
                    shot.club_type, shot.club_brand, shot.club_model,
                    shot.carry_distance, shot.total_distance, shot.ball_speed,
                    shot.club_speed, shot.smash_factor, shot.launch_angle,
                    shot.launch_direction, shot.apex, shot.side_carry,
                    shot.descent_angle, shot.attack_angle, shot.club_path,
                    shot.spin_rate, shot.spin_axis, shot.club_data_est
                ],
            ).map_err(|e| e.to_string())?;
        }

        tx.commit().map_err(|e| e.to_string())?;
        Ok(shots.len())
    })();

    match result {
        Ok(n) => ImportResult {
            message: format!("Imported {} shots", n),
            filename,
            status: ImportStatus::Imported,
        },
        Err(e) => ImportResult { filename, status: ImportStatus::Error, message: e },
    }
}

#[tauri::command]
fn import_sessions(app: tauri::AppHandle, file_paths: Vec<String>, profile_id: i64) -> std::result::Result<ImportSummary, String> {
    let conn = Connection::open(db_path(&app)).map_err(|e| e.to_string())?;

    let results: Vec<ImportResult> = file_paths.iter()
        .map(|p| import_one(&conn, p, profile_id))
        .collect();

    let imported = results.iter().filter(|r| r.status == ImportStatus::Imported).count();
    let skipped  = results.iter().filter(|r| r.status == ImportStatus::Skipped).count();
    let errors   = results.iter().filter(|r| r.status == ImportStatus::Error).count();

    Ok(ImportSummary { results, imported, skipped, errors })
}

#[tauri::command]
fn get_sessions(app: tauri::AppHandle) -> std::result::Result<Vec<Session>, String> {
    let path = db_path(&app);
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT s.id, s.profile_id, p.name, s.date, s.source_filename,
                COUNT(sh.id) as shot_count
         FROM sessions s
         JOIN profiles p ON s.profile_id = p.id
         LEFT JOIN shots sh ON sh.session_id = s.id
         GROUP BY s.id
         ORDER BY s.date DESC"
    ).map_err(|e| e.to_string())?;

    let sessions = stmt.query_map([], |row| {
        Ok(Session {
            id: row.get(0)?,
            profile_id: row.get(1)?,
            player_name: row.get(2)?,
            date: row.get(3)?,
            source_filename: row.get(4)?,
            shot_count: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|s| s.ok())
    .collect();

    Ok(sessions)
}

#[tauri::command]
fn get_shots(app: tauri::AppHandle, session_id: i64) -> std::result::Result<Vec<Shot>, String> {
    let path = db_path(&app);
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT club_type, club_brand, club_model, carry_distance, total_distance,
         ball_speed, club_speed, smash_factor, launch_angle, launch_direction,
         apex, side_carry, descent_angle, attack_angle, club_path,
         spin_rate, spin_axis, club_data_est
         FROM shots WHERE session_id = ?1"
    ).map_err(|e| e.to_string())?;

    let shots = stmt.query_map([session_id], |row| {
        Ok(Shot {
            club_type:        row.get(0)?,
            club_brand:       row.get(1)?,
            club_model:       row.get(2)?,
            carry_distance:   row.get(3)?,
            total_distance:   row.get(4)?,
            ball_speed:       row.get(5)?,
            club_speed:       row.get(6)?,
            smash_factor:     row.get(7)?,
            launch_angle:     row.get(8)?,
            launch_direction: row.get(9)?,
            apex:             row.get(10)?,
            side_carry:       row.get(11)?,
            descent_angle:    row.get(12)?,
            attack_angle:     row.get(13)?,
            club_path:        row.get(14)?,
            spin_rate:        row.get(15)?,
            spin_axis:        row.get(16)?,
            club_data_est:    row.get(17)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|s| s.ok())
    .collect();

    Ok(shots)
}

#[derive(Debug, Serialize)]
pub struct ClubStat {
    pub club_type: String,
    pub shot_count: i64,
    pub avg_carry: f64,
    pub avg_side_carry: f64,
    pub std_side_carry: f64,
    pub min_side_carry: f64,
    pub max_side_carry: f64,
}

#[tauri::command]
fn get_club_stats(app: tauri::AppHandle, session_id: Option<i64>) -> std::result::Result<Vec<ClubStat>, String> {
    let path = db_path(&app);
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    let rows: Vec<(String, f64, f64)> = match session_id {
        Some(id) => {
            let mut stmt = conn.prepare(
                "SELECT club_type, carry_distance, side_carry FROM shots WHERE session_id = ?1"
            ).map_err(|e| e.to_string())?;
            let rows: Vec<_> = stmt.query_map([id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            rows
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT club_type, carry_distance, side_carry FROM shots"
            ).map_err(|e| e.to_string())?;
            let rows: Vec<_> = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            rows
        }
    };

    // Group by club_type
    let mut map: std::collections::HashMap<String, Vec<(f64, f64)>> = std::collections::HashMap::new();
    for (club, carry, side) in rows {
        map.entry(club).or_default().push((carry, side));
    }

    let mut stats: Vec<ClubStat> = map.into_iter().map(|(club_type, shots)| {
        let count = shots.len() as i64;
        let avg_carry = shots.iter().map(|(c, _)| c).sum::<f64>() / count as f64;
        let avg_side = shots.iter().map(|(_, s)| s).sum::<f64>() / count as f64;
        let variance = shots.iter().map(|(_, s)| (s - avg_side).powi(2)).sum::<f64>() / count as f64;
        let std_side = variance.sqrt();
        let min_side = shots.iter().map(|(_, s)| *s).fold(f64::INFINITY, f64::min);
        let max_side = shots.iter().map(|(_, s)| *s).fold(f64::NEG_INFINITY, f64::max);

        ClubStat {
            club_type,
            shot_count: count,
            avg_carry,
            avg_side_carry: avg_side,
            std_side_carry: std_side,
            min_side_carry: min_side,
            max_side_carry: max_side,
        }
    }).collect();

    stats.sort_by(|a, b| b.avg_carry.partial_cmp(&a.avg_carry).unwrap_or(std::cmp::Ordering::Equal));

    Ok(stats)
}

#[tauri::command]
fn delete_session(app: tauri::AppHandle, session_id: i64) -> std::result::Result<(), String> {
    let path = db_path(&app);
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM shots WHERE session_id = ?1", [session_id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM sessions WHERE id = ?1", [session_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_profile(app: tauri::AppHandle, profile_id: i64) -> std::result::Result<(), String> {
    let conn = Connection::open(db_path(&app)).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id FROM sessions WHERE profile_id = ?1")
        .map_err(|e| e.to_string())?;
    let session_ids: Vec<i64> = stmt.query_map([profile_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);
    for sid in session_ids {
        conn.execute("DELETE FROM shots WHERE session_id = ?1", [sid]).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM sessions WHERE id = ?1", [sid]).map_err(|e| e.to_string())?;
    }
    conn.execute("DELETE FROM profiles WHERE id = ?1", [profile_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_profiles(app: tauri::AppHandle) -> std::result::Result<Vec<Profile>, String> {
    let conn = Connection::open(db_path(&app)).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name FROM profiles ORDER BY id ASC")
        .map_err(|e| e.to_string())?;
    let profiles = stmt.query_map([], |row| {
        Ok(Profile { id: row.get(0)?, name: row.get(1)? })
    }).map_err(|e| e.to_string())?
    .filter_map(|p| p.ok())
    .collect();
    Ok(profiles)
}

#[tauri::command]
fn add_profile(app: tauri::AppHandle, name: String) -> std::result::Result<Profile, String> {
    let conn = Connection::open(db_path(&app)).map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO profiles (name) VALUES (?1)", [&name])
        .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Profile { id, name })
}

#[cfg(debug_assertions)]
#[tauri::command]
fn wipe_db(app: tauri::AppHandle) -> std::result::Result<(), String> {
    let path = db_path(&app);
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch("DELETE FROM shots; DELETE FROM sessions;")
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let path = db_path(app.handle());
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent).expect("failed to create app data dir");
            }
            let conn = Connection::open(&path)
                .expect("failed to open database");
            init_db(&conn).expect("failed to initialize database");

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            import_sessions,
            get_sessions,
            get_shots,
            get_club_stats,
            delete_session,
            get_profiles,
            add_profile,
            delete_profile,
            #[cfg(debug_assertions)]
            wipe_db,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}