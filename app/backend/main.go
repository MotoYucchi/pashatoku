package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"

	_ "github.com/lib/pq"
	"github.com/makiuchi-d/gozxing"
	"github.com/makiuchi-d/gozxing/qrcode"
	"github.com/rs/cors"
	"golang.org/x/image/draw"
)

type App struct {
	QuizDB *sql.DB
	UserDB *sql.DB
}

type User struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	StudentID string `json:"student_id"`
}

type Question struct {
	ID               int      `json:"id"`
	QuizID           int      `json:"quiz_id"`
	Code             string   `json:"code"`
	Text             string   `json:"text"`
	Options          []string `json:"options"`
	CorrectIndex     int      `json:"correct_index"`
	Points           int      `json:"points"`
	QuestionType     string   `json:"question_type"`
	MediaURL         string   `json:"media_url"`
	Hint             string   `json:"hint"`
	PenaltyPoints    int      `json:"penalty_points"`
	Explanation      string   `json:"explanation"`
	Lat              *float64 `json:"lat"`
	Lng              *float64 `json:"lng"`
	Radius           *float64 `json:"radius"`
	ResultDisplay    string   `json:"result_display"`
	SelectedIndex    *int     `json:"selected_index,omitempty"`
	IsCorrect        *bool    `json:"is_correct,omitempty"`
	PointsAwarded    *int     `json:"points_awarded,omitempty"`
	CanViewDetail    bool     `json:"can_view_detail"`
}

type AnswerRequest struct {
	UserID        int    `json:"user_id"`
	QuestionID    int    `json:"question_id"`
	SelectedIndex int    `json:"selected_index"`
	AnswerText    string `json:"answer_text"`
	UsedHint      bool   `json:"used_hint"`
}

type AnswerResponse struct {
	IsCorrect        bool   `json:"is_correct"`
	PointsAwarded    int    `json:"points_awarded"`
	Explanation      string `json:"explanation"`
	CorrectIndex     int    `json:"correct_index"`
	IsLocked         bool   `json:"is_locked"`
	Message          string `json:"message"`
	EffectiveDisplay string `json:"effective_display"` // "immediate" or "after_end"
}

type Quiz struct {
	ID               int        `json:"id"`
	Code             string     `json:"code"`
	Title            string     `json:"title"`
	Mode             string     `json:"mode"`
	Style            string     `json:"style"`
	Visibility       string     `json:"visibility"`
	PlayStatus       string     `json:"play_status"`
	ResultDisplay    string     `json:"result_display"` // "immediate" or "after_end"
	TimerDurationSec *int       `json:"timer_duration_sec"`
	TimerEndAt       *time.Time `json:"timer_end_at"`
	Questions        []Question `json:"questions"`
}

type QuizResult struct {
	UserID       int     `json:"user_id"`
	UserName     string  `json:"user_name"`
	StudentID    string  `json:"student_id"`
	TotalScore   int     `json:"total_score"`
	AttemptCount int     `json:"attempt_count"`
	CorrectCount int     `json:"correct_count"`
	Accuracy     float64 `json:"accuracy"`
}

func createTables(app *App) {
	userSchema := `CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		name VARCHAR(16) NOT NULL,
		student_id TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS external_scans (
	    user_id INTEGER PRIMARY KEY,
	    code TEXT NOT NULL,
	    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := app.UserDB.Exec(userSchema); err != nil {
		log.Fatal("Failed to create User table:", err)
	}

	quizSchema := `
	CREATE TABLE IF NOT EXISTS quizzes (
		id SERIAL PRIMARY KEY,
		code VARCHAR(50) UNIQUE NOT NULL,
		title TEXT NOT NULL,
		mode VARCHAR(20) DEFAULT 'normal',
		style VARCHAR(20) DEFAULT 'free',
		visibility VARCHAR(20) DEFAULT 'open',
		play_status VARCHAR(20) DEFAULT 'waiting',
		result_display VARCHAR(20) DEFAULT 'immediate',
		timer_duration_sec INTEGER,
		timer_end_at TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS quiz_questions (
	    id SERIAL PRIMARY KEY,
	    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
	    code VARCHAR(10),
	    text TEXT NOT NULL,
	    options JSONB NOT NULL,
	    correct_index INTEGER NOT NULL,
		points INTEGER DEFAULT 1,
		question_type VARCHAR(20) DEFAULT 'radio',
		media_url TEXT DEFAULT '',
		hint TEXT DEFAULT '',
		penalty_points INTEGER DEFAULT 0,
		explanation TEXT DEFAULT '',
		lat DOUBLE PRECISION,
		lng DOUBLE PRECISION,
		radius DOUBLE PRECISION,
		result_display VARCHAR(20) DEFAULT 'inherit'
	);
	CREATE TABLE IF NOT EXISTS quiz_answers (
		id SERIAL PRIMARY KEY,
		question_id INTEGER REFERENCES quiz_questions(id) ON DELETE CASCADE,
		user_id INTEGER NOT NULL,
		selected_index INTEGER DEFAULT -1,
		is_correct BOOLEAN NOT NULL,
		points INTEGER NOT NULL,
		answer_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS quiz_locks (
	    question_id INTEGER PRIMARY KEY REFERENCES quiz_questions(id) ON DELETE CASCADE,
	    user_id INTEGER NOT NULL,
	    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS global_settings (
	    key VARCHAR(50) PRIMARY KEY,
	    value TEXT NOT NULL
	);`
	if _, err := app.QuizDB.Exec(quizSchema); err != nil {
		log.Fatal("Failed to create Quiz table:", err)
	}

	// Backward-compatible schema migrations for existing DB volumes
	app.QuizDB.Exec("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS timer_duration_sec INTEGER;")
	app.QuizDB.Exec("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS timer_end_at TIMESTAMP;")
	app.QuizDB.Exec("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS result_display VARCHAR(20) DEFAULT 'immediate';")
	app.QuizDB.Exec("ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS result_display VARCHAR(20) DEFAULT 'inherit';")
	app.QuizDB.Exec("ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS selected_index INTEGER DEFAULT -1;")

	var count int
	err := app.QuizDB.QueryRow("SELECT COUNT(*) FROM quizzes").Scan(&count)
	if err == nil && count == 0 {
		insertExampleQuizzes(app.QuizDB)
	}
	fmt.Println("Database tables initialized.")
}

func insertExampleQuizzes(db *sql.DB) {
	examples := []Quiz{
		{
			Code:          "demo1",
			Title:         "サンプルクイズ 1: IT基礎",
			Mode:          "normal",
			Style:         "free",
			Visibility:    "open",
			PlayStatus:    "started",
			ResultDisplay: "immediate",
			Questions: []Question{
				{Text: "HTMLは何の略？", Options: []string{"HyperText Markup Language", "HighText Machine Language", "HyperTool Multi Language", "None of the above"}, CorrectIndex: 0, Points: 1, QuestionType: "radio", Explanation: "HTMLはWebページの骨組みを作るHyperText Markup Languageの略です。", ResultDisplay: "inherit"},
				{Text: "次のうちプログラミング言語ではないものは？", Options: []string{"Python", "Java", "HTML", "C++"}, CorrectIndex: 2, Points: 1, QuestionType: "radio", Explanation: "HTMLはマークアップ言語であり、プログラミング言語ではありません。", ResultDisplay: "inherit"},
			},
		},
		{
			Code:          "demo2",
			Title:         "サンプルクイズ 2: 早押しテスト",
			Mode:          "normal",
			Style:         "fastest",
			Visibility:    "open",
			PlayStatus:    "waiting",
			ResultDisplay: "after_end",
			Questions: []Question{
				{Text: "日本で一番高い山は？", Options: []string{"北岳", "富士山", "奥穂高岳", "槍ヶ岳"}, CorrectIndex: 1, Points: 5, QuestionType: "radio", Explanation: "標高3,776mの富士山が日本一高い山です。", ResultDisplay: "inherit"},
				{Text: "日本の最北端の島は？", Options: []string{"択捉島", "利尻島", "礼文島", "与那国島"}, CorrectIndex: 0, Points: 5, QuestionType: "radio", Explanation: "日本の最北端は択捉島（えとろふとう）です。", ResultDisplay: "inherit"},
			},
		},
	}

	for _, quiz := range examples {
		var qID int
		err := db.QueryRow(
			"INSERT INTO quizzes (code, title, mode, style, visibility, play_status, result_display) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
			quiz.Code, quiz.Title, quiz.Mode, quiz.Style, quiz.Visibility, quiz.PlayStatus, quiz.ResultDisplay,
		).Scan(&qID)
		if err == nil {
			for _, q := range quiz.Questions {
				opts, _ := json.Marshal(q.Options)
				db.Exec(
					"INSERT INTO quiz_questions (quiz_id, code, text, options, correct_index, points, question_type, explanation, result_display) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
					qID, generateRandomString(3), q.Text, opts, q.CorrectIndex, q.Points, q.QuestionType, q.Explanation, q.ResultDisplay,
				)
			}
		}
	}
	fmt.Println("Example quizzes inserted.")
}

func isValidName(name string) bool {
	runes := []rune(name)
	if len(runes) == 0 || len(runes) > 16 {
		return false
	}
	for _, r := range runes {
		if unicode.IsSymbol(r) || (unicode.IsPunct(r) && r != '・' && r != 'ー' && r != '-') {
			return false
		}
	}
	return true
}

func generateRandomString(length int) string {
	const charset = "abcdefghijkmnpqrstuvwxyz23456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

func generateQuizCode() string {
	return generateRandomString(5)
}

func resolveResultDisplay(quizDisplay, questionDisplay string) string {
	if questionDisplay == "immediate" || questionDisplay == "after_end" {
		return questionDisplay
	}
	if quizDisplay == "after_end" {
		return "after_end"
	}
	return "immediate"
}

func (app *App) getGlobalTimerValue() *string {
	var val string
	err := app.QuizDB.QueryRow("SELECT value FROM global_settings WHERE key = 'global_timer_end_at'").Scan(&val)
	if err != nil || val == "" {
		return nil
	}
	return &val
}

func (app *App) isGlobalTimerExpired() bool {
	val := app.getGlobalTimerValue()
	if val == nil {
		return false
	}
	t, err := time.Parse(time.RFC3339, *val)
	if err != nil {
		return false
	}
	return time.Now().After(t)
}

func (app *App) registerUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	u.Name = strings.TrimSpace(u.Name)
	u.StudentID = strings.TrimSpace(u.StudentID)
	if u.StudentID == "" {
		u.StudentID = "GUEST"
	}

	if !isValidName(u.Name) {
		http.Error(w, "お名前は1〜16文字（記号なし）で入力してください。", http.StatusUnprocessableEntity)
		return
	}

	// Re-use existing user if same name and student_id already registered
	err := app.UserDB.QueryRow("SELECT id FROM users WHERE name = $1 AND student_id = $2 ORDER BY id DESC LIMIT 1", u.Name, u.StudentID).Scan(&u.ID)
	if err != nil {
		query := `INSERT INTO users (name, student_id) VALUES ($1, $2) RETURNING id`
		err = app.UserDB.QueryRow(query, u.Name, u.StudentID).Scan(&u.ID)
		if err != nil {
			log.Printf("DB error: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

func (app *App) createQuizHandler(w http.ResponseWriter, r *http.Request) {
	var q Quiz
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if q.Code == "" {
		q.Code = generateQuizCode()
	}
	if q.Mode == "" {
		q.Mode = "normal"
	}
	if q.Style == "" {
		q.Style = "free"
	}
	if q.ResultDisplay == "" {
		q.ResultDisplay = "immediate"
	}
	q.Visibility = "open"
	q.PlayStatus = "waiting"

	tx, err := app.QuizDB.Begin()
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}

	err = tx.QueryRow(
		"INSERT INTO quizzes (code, title, mode, style, visibility, play_status, result_display, timer_duration_sec) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
		q.Code, q.Title, q.Mode, q.Style, q.Visibility, q.PlayStatus, q.ResultDisplay, q.TimerDurationSec,
	).Scan(&q.ID)
	if err != nil {
		tx.Rollback()
		log.Printf("DB error: %v", err)
		http.Error(w, "Code might already exist. Please choose another code.", http.StatusConflict)
		return
	}

	for i, question := range q.Questions {
		optionsJSON, _ := json.Marshal(question.Options)
		if question.QuestionType == "" {
			question.QuestionType = "radio"
		}
		if question.Points == 0 {
			question.Points = 1
		}
		if question.ResultDisplay == "" {
			question.ResultDisplay = "inherit"
		}

		qCode := strings.TrimSpace(question.Code)
		if qCode == "" {
			qCode = generateRandomString(3)
		}

		err = tx.QueryRow(
			`INSERT INTO quiz_questions
			(quiz_id, code, text, options, correct_index, points, question_type, media_url, hint, penalty_points, explanation, lat, lng, radius, result_display)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
			q.ID, qCode, question.Text, optionsJSON, question.CorrectIndex, question.Points, question.QuestionType,
			question.MediaURL, question.Hint, question.PenaltyPoints, question.Explanation, question.Lat, question.Lng, question.Radius, question.ResultDisplay,
		).Scan(&q.Questions[i].ID)
		if err != nil {
			tx.Rollback()
			log.Printf("DB error: %v", err)
			http.Error(w, "Failed to insert question", http.StatusInternalServerError)
			return
		}
		q.Questions[i].QuizID = q.ID
		q.Questions[i].Code = qCode
		q.Questions[i].ResultDisplay = question.ResultDisplay
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}

func adjustQuizStatus(playStatus *string, timerEndAt *time.Time) {
	if playStatus != nil && *playStatus == "started" && timerEndAt != nil {
		if time.Now().After(*timerEndAt) {
			*playStatus = "ended"
		}
	}
}

// Unified sync endpoint: returns global timer, external scan, and optional quiz status in 1 lightweight call
func (app *App) syncHandler(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("user_id")
	code := strings.TrimSpace(r.URL.Query().Get("code"))

	resp := map[string]interface{}{
		"server_time":         time.Now().UTC().Format(time.RFC3339),
		"global_timer_end_at": app.getGlobalTimerValue(),
		"external_code":       nil,
		"quiz_status":         nil,
	}

	if userIDStr != "" {
		var scannedCode string
		err := app.UserDB.QueryRow("DELETE FROM external_scans WHERE user_id = $1 RETURNING code", userIDStr).Scan(&scannedCode)
		if err == nil && scannedCode != "" {
			resp["external_code"] = scannedCode
		}
	}

	if code != "" {
		var q Quiz
		var nullTimer sql.NullTime
		var nullResultDisplay sql.NullString
		err := app.QuizDB.QueryRow(
			"SELECT id, code, visibility, play_status, COALESCE(result_display, 'immediate'), timer_end_at FROM quizzes WHERE LOWER(code) = LOWER($1)",
			code,
		).Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus, &nullResultDisplay, &nullTimer)
		if nullTimer.Valid {
			t := nullTimer.Time
			q.TimerEndAt = &t
		}
		if nullResultDisplay.Valid {
			q.ResultDisplay = nullResultDisplay.String
		}

		if err == sql.ErrNoRows {
			var quizID int
			err = app.QuizDB.QueryRow("SELECT quiz_id FROM quiz_questions WHERE LOWER(code) = LOWER($1)", code).Scan(&quizID)
			if err == nil {
				var nullTimer2 sql.NullTime
				var nullRD2 sql.NullString
				err = app.QuizDB.QueryRow(
					"SELECT id, code, visibility, play_status, COALESCE(result_display, 'immediate'), timer_end_at FROM quizzes WHERE id = $1",
					quizID,
				).Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus, &nullRD2, &nullTimer2)
				if nullTimer2.Valid {
					t2 := nullTimer2.Time
					q.TimerEndAt = &t2
				}
				if nullRD2.Valid {
					q.ResultDisplay = nullRD2.String
				}
			}
		}

		if err == nil {
			adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)
			resp["quiz_status"] = map[string]interface{}{
				"id":             q.ID,
				"code":           q.Code,
				"visibility":     q.Visibility,
				"play_status":    q.PlayStatus,
				"result_display": q.ResultDisplay,
				"timer_end_at":   q.TimerEndAt,
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (app *App) getQuizStatusHandler(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if code == "" {
		http.Error(w, "Missing quiz code", http.StatusBadRequest)
		return
	}

	var q Quiz
	var nullTimer sql.NullTime
	err := app.QuizDB.QueryRow(
		"SELECT id, code, visibility, play_status, COALESCE(result_display, 'immediate'), timer_end_at FROM quizzes WHERE LOWER(code) = LOWER($1)",
		code,
	).Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus, &q.ResultDisplay, &nullTimer)
	if nullTimer.Valid {
		t := nullTimer.Time
		q.TimerEndAt = &t
	}

	if err == sql.ErrNoRows {
		var quizID int
		err = app.QuizDB.QueryRow("SELECT quiz_id FROM quiz_questions WHERE LOWER(code) = LOWER($1)", code).Scan(&quizID)
		if err != nil {
			http.Error(w, "Quiz not found", http.StatusNotFound)
			return
		}
		var nullTimer2 sql.NullTime
		err = app.QuizDB.QueryRow(
			"SELECT id, code, visibility, play_status, COALESCE(result_display, 'immediate'), timer_end_at FROM quizzes WHERE id = $1",
			quizID,
		).Scan(&q.ID, &q.Code, &q.Visibility, &q.PlayStatus, &q.ResultDisplay, &nullTimer2)
		if nullTimer2.Valid {
			t2 := nullTimer2.Time
			q.TimerEndAt = &t2
		}
	}

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"visibility":     q.Visibility,
		"play_status":    q.PlayStatus,
		"result_display": q.ResultDisplay,
		"timer_end_at":   q.TimerEndAt,
	})
}

func (app *App) getQuizHandler(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if code == "" {
		http.Error(w, "Missing quiz code", http.StatusBadRequest)
		return
	}

	var q Quiz
	questionCodeFilter := ""

	var nullTimer sql.NullTime
	err := app.QuizDB.QueryRow(
		"SELECT id, code, title, mode, style, visibility, play_status, COALESCE(result_display, 'immediate'), timer_duration_sec, timer_end_at FROM quizzes WHERE LOWER(code) = LOWER($1)",
		code,
	).Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.ResultDisplay, &q.TimerDurationSec, &nullTimer)
	if nullTimer.Valid {
		t := nullTimer.Time
		q.TimerEndAt = &t
	}

	if err == sql.ErrNoRows {
		var quizID int
		var matchedQCode string
		err = app.QuizDB.QueryRow("SELECT quiz_id, code FROM quiz_questions WHERE LOWER(code) = LOWER($1)", code).Scan(&quizID, &matchedQCode)
		if err != nil {
			http.Error(w, "Quiz or Question not found", http.StatusNotFound)
			return
		}
		var nullTimer2 sql.NullTime
		err = app.QuizDB.QueryRow(
			"SELECT id, code, title, mode, style, visibility, play_status, COALESCE(result_display, 'immediate'), timer_duration_sec, timer_end_at FROM quizzes WHERE id = $1",
			quizID,
		).Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.ResultDisplay, &q.TimerDurationSec, &nullTimer2)
		if nullTimer2.Valid {
			t2 := nullTimer2.Time
			q.TimerEndAt = &t2
		}
		questionCodeFilter = matchedQCode
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)
	if q.Visibility == "closed" {
		http.Error(w, "This quiz is closed", http.StatusForbidden)
		return
	}

	if q.PlayStatus == "waiting" {
		q.Questions = []Question{}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(q)
		return
	}

	query := `
		SELECT id, COALESCE(code, ''), text, options, correct_index, points, question_type, media_url, hint, penalty_points, explanation, lat, lng, radius, COALESCE(result_display, 'inherit')
		FROM quiz_questions WHERE quiz_id = $1`

	var rows *sql.Rows
	if questionCodeFilter != "" {
		query += " AND LOWER(code) = LOWER($2) ORDER BY id"
		rows, err = app.QuizDB.Query(query, q.ID, questionCodeFilter)
	} else {
		query += " ORDER BY id"
		rows, err = app.QuizDB.Query(query, q.ID)
	}

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var question Question
		var optionsJSON []byte
		if err := rows.Scan(
			&question.ID, &question.Code, &question.Text, &optionsJSON, &question.CorrectIndex,
			&question.Points, &question.QuestionType, &question.MediaURL, &question.Hint,
			&question.PenaltyPoints, &question.Explanation, &question.Lat, &question.Lng, &question.Radius, &question.ResultDisplay,
		); err != nil {
			continue
		}
		json.Unmarshal(optionsJSON, &question.Options)
		question.QuizID = q.ID
		q.Questions = append(q.Questions, question)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}

func (app *App) userHistoryHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userID := parts[3] // /api/user/{id}/history

	globalExpired := app.isGlobalTimerExpired()

	rows, err := app.QuizDB.Query(`
		SELECT qz.id, qz.code, qz.title, qz.play_status, COALESCE(qz.result_display, 'immediate'), qz.timer_end_at,
		       COALESCE(SUM(qa.points), 0) as total_score
		FROM quizzes qz
		JOIN quiz_questions qq ON qz.id = qq.quiz_id
		JOIN quiz_answers qa ON qq.id = qa.question_id
		WHERE qa.user_id = $1
		GROUP BY qz.id, qz.code, qz.title, qz.play_status, qz.result_display, qz.timer_end_at
		ORDER BY qz.id DESC
	`, userID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type HistoryItem struct {
		QuizID         int        `json:"quiz_id"`
		Code           string     `json:"code"`
		Title          string     `json:"title"`
		PlayStatus     string     `json:"play_status"`
		ResultDisplay  string     `json:"result_display"`
		TimerEndAt     *time.Time `json:"timer_end_at"`
		TotalScore     int        `json:"total_score"`
		TotalQuestions int        `json:"total_questions"`
		AnsweredCount  int        `json:"answered_count"`
		CorrectCount   int        `json:"correct_count"`
		Questions      []Question `json:"questions"`
	}

	var history []HistoryItem
	for rows.Next() {
		var h HistoryItem
		var nullTimer sql.NullTime
		rows.Scan(&h.QuizID, &h.Code, &h.Title, &h.PlayStatus, &h.ResultDisplay, &nullTimer, &h.TotalScore)
		if nullTimer.Valid {
			t := nullTimer.Time
			h.TimerEndAt = &t
		}
		adjustQuizStatus(&h.PlayStatus, h.TimerEndAt)
		if globalExpired {
			h.PlayStatus = "ended"
		}
		history = append(history, h)
	}

	for i, h := range history {
		qRows, err := app.QuizDB.Query(`
			SELECT qq.id, COALESCE(qq.code, ''), qq.text, qq.options, qq.correct_index, qq.points, qq.explanation, COALESCE(qq.result_display, 'inherit'),
			       qa.selected_index, qa.is_correct, qa.points
			FROM quiz_questions qq
			LEFT JOIN quiz_answers qa ON qq.id = qa.question_id AND qa.user_id = $1
			WHERE qq.quiz_id = $2
			ORDER BY qq.id
		`, userID, h.QuizID)
		if err != nil || qRows == nil {
			continue
		}

		for qRows.Next() {
			var q Question
			var optionsJSON []byte
			var selectedIdx sql.NullInt32
			var isCorr sql.NullBool
			var awardedPts sql.NullInt32

			qRows.Scan(
				&q.ID, &q.Code, &q.Text, &optionsJSON, &q.CorrectIndex, &q.Points, &q.Explanation, &q.ResultDisplay,
				&selectedIdx, &isCorr, &awardedPts,
			)
			json.Unmarshal(optionsJSON, &q.Options)
			h.TotalQuestions++

			effectiveMode := resolveResultDisplay(h.ResultDisplay, q.ResultDisplay)
			isEnded := h.PlayStatus == "ended"

			if selectedIdx.Valid {
				h.AnsweredCount++
				sIdx := int(selectedIdx.Int32)
				q.SelectedIndex = &sIdx
			}

			if isCorr.Valid {
				cVal := isCorr.Bool
				ptsVal := int(awardedPts.Int32)
				if cVal {
					h.CorrectCount++
				}

				// Can the user view the detailed answer/explanation right now?
				if effectiveMode == "immediate" || isEnded {
					q.CanViewDetail = true
					q.IsCorrect = &cVal
					q.PointsAwarded = &ptsVal
				} else {
					q.CanViewDetail = false
					q.CorrectIndex = -1
					q.Explanation = ""
				}
			} else {
				// Unanswered question: only show details if the quiz has ended
				if isEnded {
					q.CanViewDetail = true
				} else {
					q.CanViewDetail = false
					q.CorrectIndex = -1
					q.Explanation = ""
				}
			}

			h.Questions = append(h.Questions, q)
		}
		qRows.Close()

		// If the quiz is still running and all answered questions are set to after_end, mask total_score if needed
		history[i] = h
	}

	if history == nil {
		history = []HistoryItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}

func (app *App) userAnsweredHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userID := parts[3]

	rows, err := app.QuizDB.Query("SELECT question_id FROM quiz_answers WHERE user_id = $1", userID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var answered []int
	for rows.Next() {
		var qid int
		rows.Scan(&qid)
		answered = append(answered, qid)
	}
	if answered == nil {
		answered = []int{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answered)
}

func (app *App) answerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	tx, err := app.QuizDB.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var q Question
	var quizStyle, quizVisibility, quizPlayStatus, quizResultDisplay string
	var nullTimer sql.NullTime
	var timerEndAt *time.Time
	err = tx.QueryRow(`
		SELECT q.correct_index, q.points, q.penalty_points, q.explanation, COALESCE(q.result_display, 'inherit'),
		       qz.style, qz.visibility, qz.play_status, COALESCE(qz.result_display, 'immediate'), qz.timer_end_at
		FROM quiz_questions q
		JOIN quizzes qz ON q.quiz_id = qz.id
		WHERE q.id = $1`, req.QuestionID).Scan(
		&q.CorrectIndex, &q.Points, &q.PenaltyPoints, &q.Explanation, &q.ResultDisplay,
		&quizStyle, &quizVisibility, &quizPlayStatus, &quizResultDisplay, &nullTimer,
	)
	if nullTimer.Valid {
		t := nullTimer.Time
		timerEndAt = &t
	}

	if err != nil {
		http.Error(w, "Question not found", http.StatusNotFound)
		return
	}
	if quizVisibility == "closed" {
		http.Error(w, "Quiz is closed", http.StatusForbidden)
		return
	}
	adjustQuizStatus(&quizPlayStatus, timerEndAt)
	if quizPlayStatus != "started" || app.isGlobalTimerExpired() {
		http.Error(w, "Quiz is not running", http.StatusForbidden)
		return
	}

	// Duplicate answer check
	var existingAnswer int
	err = tx.QueryRow("SELECT id FROM quiz_answers WHERE question_id = $1 AND user_id = $2", req.QuestionID, req.UserID).Scan(&existingAnswer)
	if err == nil {
		http.Error(w, "Already answered", http.StatusConflict)
		return
	}

	if quizStyle == "fastest" {
		var lockedBy int
		err = tx.QueryRow("SELECT user_id FROM quiz_locks WHERE question_id = $1", req.QuestionID).Scan(&lockedBy)
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(AnswerResponse{
				IsLocked: true,
				Message:  "この問題はすでに他の参加者にクリアされています！",
			})
			return
		}
	}

	isCorrect := req.SelectedIndex == q.CorrectIndex
	awardedPoints := 0
	if isCorrect {
		awardedPoints = q.Points
		if req.UsedHint {
			awardedPoints = awardedPoints / 2
		}

		if quizStyle == "fastest" {
			_, err = tx.Exec("INSERT INTO quiz_locks (question_id, user_id) VALUES ($1, $2)", req.QuestionID, req.UserID)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(AnswerResponse{
					IsLocked: true,
					Message:  "タッチの差で他の参加者にクリアされました！",
				})
				return
			}
		}
	} else {
		awardedPoints = -q.PenaltyPoints
	}

	_, err = tx.Exec(`
		INSERT INTO quiz_answers (question_id, user_id, selected_index, is_correct, points)
		VALUES ($1, $2, $3, $4, $5)`, req.QuestionID, req.UserID, req.SelectedIndex, isCorrect, awardedPoints)
	if err != nil {
		http.Error(w, "Failed to record answer", http.StatusInternalServerError)
		return
	}

	tx.Commit()

	effectiveDisplay := resolveResultDisplay(quizResultDisplay, q.ResultDisplay)

	resp := AnswerResponse{
		IsCorrect:        isCorrect,
		PointsAwarded:    awardedPoints,
		Explanation:      q.Explanation,
		CorrectIndex:     q.CorrectIndex,
		IsLocked:         false,
		EffectiveDisplay: effectiveDisplay,
	}

	// If set to "after_end", do not leak correctness or explanation until the quiz ends
	if effectiveDisplay == "after_end" {
		resp.Explanation = ""
		resp.CorrectIndex = -1
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (app *App) adminGetQuizzesHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := app.QuizDB.Query("SELECT id, code, title, mode, style, visibility, play_status, COALESCE(result_display, 'immediate'), timer_duration_sec, timer_end_at FROM quizzes ORDER BY id DESC")
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	quizzes := []Quiz{}
	for rows.Next() {
		var q Quiz
		var nullTimer sql.NullTime
		rows.Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.ResultDisplay, &q.TimerDurationSec, &nullTimer)
		if nullTimer.Valid {
			t := nullTimer.Time
			q.TimerEndAt = &t
		}
		adjustQuizStatus(&q.PlayStatus, q.TimerEndAt)
		quizzes = append(quizzes, q)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(quizzes)
}

func (app *App) adminUpdateQuizStatusHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	quizID := parts[4] // /api/admin/quizzes/{id}/status

	var req struct {
		Visibility    *string `json:"visibility"`
		PlayStatus    *string `json:"play_status"`
		ResultDisplay *string `json:"result_display"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if req.Visibility != nil {
		app.QuizDB.Exec("UPDATE quizzes SET visibility = $1 WHERE id = $2", *req.Visibility, quizID)
	}
	if req.ResultDisplay != nil {
		app.QuizDB.Exec("UPDATE quizzes SET result_display = $1 WHERE id = $2", *req.ResultDisplay, quizID)
	}
	if req.PlayStatus != nil {
		if *req.PlayStatus == "started" {
			app.QuizDB.Exec("UPDATE quizzes SET play_status = $1, timer_end_at = CASE WHEN timer_duration_sec IS NOT NULL THEN CURRENT_TIMESTAMP + (timer_duration_sec || ' seconds')::interval ELSE NULL END WHERE id = $2", *req.PlayStatus, quizID)
		} else {
			app.QuizDB.Exec("UPDATE quizzes SET play_status = $1 WHERE id = $2", *req.PlayStatus, quizID)
		}
	}

	w.WriteHeader(http.StatusOK)
}

func (app *App) adminGetResultsHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	quizID := parts[4] // /api/admin/quizzes/{id}/results

	rows, err := app.QuizDB.Query(`
        SELECT
            user_id,
            SUM(qa.points) as total_score,
            COUNT(*) as attempt_count,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count
        FROM quiz_answers qa
        JOIN quiz_questions qq ON qa.question_id = qq.id
        WHERE qq.quiz_id = $1
        GROUP BY user_id
        ORDER BY total_score DESC
    `, quizID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []QuizResult
	for rows.Next() {
		var r QuizResult
		rows.Scan(&r.UserID, &r.TotalScore, &r.AttemptCount, &r.CorrectCount)
		if r.AttemptCount > 0 {
			r.Accuracy = float64(r.CorrectCount) / float64(r.AttemptCount) * 100
		}
		results = append(results, r)
	}

	for i, res := range results {
		var name, studentID string
		err := app.UserDB.QueryRow("SELECT name, student_id FROM users WHERE id = $1", res.UserID).Scan(&name, &studentID)
		if err == nil {
			results[i].UserName = name
			results[i].StudentID = studentID
		} else {
			results[i].UserName = "Unknown"
		}
	}

	if results == nil {
		results = []QuizResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (app *App) adminUpdateQuizHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	quizID := parts[4] // /api/admin/quizzes/{id}

	var q Quiz
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if q.ResultDisplay == "" {
		q.ResultDisplay = "immediate"
	}

	tx, err := app.QuizDB.Begin()
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("UPDATE quizzes SET title = $1, mode = $2, style = $3, result_display = $4, timer_duration_sec = $5 WHERE id = $6",
		q.Title, q.Mode, q.Style, q.ResultDisplay, q.TimerDurationSec, quizID)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to update quiz", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("DELETE FROM quiz_questions WHERE quiz_id = $1", quizID)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to delete old questions", http.StatusInternalServerError)
		return
	}

	for i, question := range q.Questions {
		optionsJSON, _ := json.Marshal(question.Options)
		if question.QuestionType == "" {
			question.QuestionType = "radio"
		}
		if question.Points == 0 {
			question.Points = 1
		}
		if question.ResultDisplay == "" {
			question.ResultDisplay = "inherit"
		}

		qCode := strings.TrimSpace(question.Code)
		if qCode == "" {
			qCode = generateRandomString(3)
		}

		err = tx.QueryRow(
			`INSERT INTO quiz_questions
			(quiz_id, code, text, options, correct_index, points, question_type, media_url, hint, penalty_points, explanation, lat, lng, radius, result_display)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
			quizID, qCode, question.Text, optionsJSON, question.CorrectIndex, question.Points, question.QuestionType,
			question.MediaURL, question.Hint, question.PenaltyPoints, question.Explanation, question.Lat, question.Lng, question.Radius, question.ResultDisplay,
		).Scan(&q.Questions[i].ID)
		if err != nil {
			tx.Rollback()
			log.Printf("DB error: %v", err)
			http.Error(w, "Failed to insert question", http.StatusInternalServerError)
			return
		}
		quizIDInt, _ := strconv.Atoi(quizID)
		q.Questions[i].QuizID = quizIDInt
		q.Questions[i].Code = qCode
		q.Questions[i].ResultDisplay = question.ResultDisplay
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}

func main() {
	rand.Seed(time.Now().UnixNano())
	quizURL := os.Getenv("QUIZ_DB_URL")
	userURL := os.Getenv("USER_DB_URL")

	app := &App{
		QuizDB: initDB(quizURL),
		UserDB: initDB(userURL),
	}
	defer app.QuizDB.Close()
	defer app.UserDB.Close()

	createTables(app)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/sync", app.syncHandler)
	mux.HandleFunc("/api/user/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/register") {
			app.registerUserHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/history") {
			app.userHistoryHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/answered") {
			app.userAnsweredHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/external_scan") {
			app.externalScanHandler(w, r)
		}
	})
	mux.HandleFunc("/api/qr/receive", app.qrReceiveHandler)
	mux.HandleFunc("/api/quizzes", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			app.createQuizHandler(w, r)
		} else if r.Method == http.MethodGet {
			app.getQuizHandler(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/quizzes/status", app.getQuizStatusHandler)
	mux.HandleFunc("/api/quizzes/answer", app.answerHandler)

	// Global Timer Handlers
	mux.HandleFunc("/api/global_timer", app.getGlobalTimerHandler)
	mux.HandleFunc("/api/admin/global_timer", app.adminGlobalTimerHandler)

	// Admin APIs
	mux.HandleFunc("/api/admin/quizzes", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			app.adminGetQuizzesHandler(w, r)
		}
	})
	mux.HandleFunc("/api/admin/quizzes/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/status") && r.Method == http.MethodPatch {
			app.adminUpdateQuizStatusHandler(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/results") && r.Method == http.MethodGet {
			app.adminGetResultsHandler(w, r)
		} else if r.Method == http.MethodPut {
			app.adminUpdateQuizHandler(w, r)
		} else if r.Method == http.MethodGet {
			parts := strings.Split(r.URL.Path, "/")
			if len(parts) >= 4 {
				quizID := parts[4]
				var q Quiz
				var nullTimer sql.NullTime
				app.QuizDB.QueryRow(
					"SELECT id, code, title, mode, style, visibility, play_status, COALESCE(result_display, 'immediate'), timer_duration_sec, timer_end_at FROM quizzes WHERE id = $1",
					quizID,
				).Scan(&q.ID, &q.Code, &q.Title, &q.Mode, &q.Style, &q.Visibility, &q.PlayStatus, &q.ResultDisplay, &q.TimerDurationSec, &nullTimer)
				if nullTimer.Valid {
					t := nullTimer.Time
					q.TimerEndAt = &t
				}
				rows, _ := app.QuizDB.Query(
					"SELECT id, COALESCE(code, ''), text, options, correct_index, points, question_type, media_url, hint, penalty_points, explanation, lat, lng, radius, COALESCE(result_display, 'inherit') FROM quiz_questions WHERE quiz_id = $1 ORDER BY id",
					quizID,
				)
				if rows != nil {
					defer rows.Close()
					for rows.Next() {
						var question Question
						var optionsJSON []byte
						rows.Scan(&question.ID, &question.Code, &question.Text, &optionsJSON, &question.CorrectIndex, &question.Points, &question.QuestionType, &question.MediaURL, &question.Hint, &question.PenaltyPoints, &question.Explanation, &question.Lat, &question.Lng, &question.Radius, &question.ResultDisplay)
						json.Unmarshal(optionsJSON, &question.Options)
						q.Questions = append(q.Questions, question)
					}
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(q)
			}
		} else {
			http.Error(w, "Not found", http.StatusNotFound)
		}
	})

	handler := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	}).Handler(mux)

	fmt.Println("Backend Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}

func initDB(url string) *sql.DB {
	var db *sql.DB
	var err error
	for i := 0; i < 10; i++ {
		db, err = sql.Open("postgres", url)
		if err == nil {
			err = db.Ping()
			if err == nil {
				return db
			}
		}
		log.Printf("DB wait... (%d/10): %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	log.Fatalf("DB connection failed after retries: %v", err)
	return nil
}

func (app *App) getGlobalTimerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	val := app.getGlobalTimerValue()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"end_at": val})
}

func (app *App) adminGlobalTimerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		DurationSec *int `json:"duration_sec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.DurationSec == nil || *req.DurationSec <= 0 {
		app.QuizDB.Exec("DELETE FROM global_settings WHERE key = 'global_timer_end_at'")
	} else {
		app.QuizDB.Exec(`
			INSERT INTO global_settings (key, value)
			VALUES ('global_timer_end_at', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC' + ($1 || ' seconds')::interval, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
		`, *req.DurationSec)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (app *App) qrReceiveHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	name := r.Header.Get("X-User-Name")
	studentID := r.Header.Get("X-Student-Id")

	if name == "" || studentID == "" {
		http.Error(w, "Missing credentials", http.StatusUnauthorized)
		return
	}

	var userID int
	err := app.UserDB.QueryRow("SELECT id FROM users WHERE name = $1 AND student_id = $2", name, studentID).Scan(&userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	contentType := r.Header.Get("Content-Type")
	var code string

	if strings.Contains(contentType, "multipart/form-data") || strings.HasPrefix(contentType, "image/") {
		var file io.Reader
		if strings.Contains(contentType, "multipart/form-data") {
			err := r.ParseMultipartForm(10 << 20)
			if err != nil {
				http.Error(w, "Invalid multipart data", http.StatusBadRequest)
				return
			}
			f, _, err := r.FormFile("image")
			if err != nil {
				http.Error(w, "Invalid image data", http.StatusBadRequest)
				return
			}
			defer f.Close()
			file = f
		} else {
			file = r.Body
		}

		img, _, err := image.Decode(file)
		if err != nil {
			http.Error(w, "Failed to decode image", http.StatusBadRequest)
			return
		}

		bounds := img.Bounds()
		if bounds.Dx() > 1920 || bounds.Dy() > 1200 {
			var newWidth, newHeight int
			if float64(bounds.Dx())/1920.0 > float64(bounds.Dy())/1200.0 {
				newWidth = 1920
				newHeight = int(float64(bounds.Dy()) * (1920.0 / float64(bounds.Dx())))
			} else {
				newHeight = 1200
				newWidth = int(float64(bounds.Dx()) * (1200.0 / float64(bounds.Dy())))
			}
			resized := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))
			draw.CatmullRom.Scale(resized, resized.Bounds(), img, bounds, draw.Over, nil)
			img = resized
		}

		bmp, _ := gozxing.NewBinaryBitmapFromImage(img)
		qrReader := qrcode.NewQRCodeReader()
		result, err := qrReader.Decode(bmp, nil)
		if err != nil {
			http.Error(w, "No QR code found", http.StatusBadRequest)
			return
		}
		code = result.GetText()
	} else {
		b, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}
		code = string(b)
	}

	if code == "" {
		http.Error(w, "Empty code", http.StatusBadRequest)
		return
	}

	app.UserDB.Exec(`
		INSERT INTO external_scans (user_id, code)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code, created_at = CURRENT_TIMESTAMP
	`, userID, code)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "code": code})
}

func (app *App) externalScanHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userID := parts[3]

	var code string
	err := app.UserDB.QueryRow("DELETE FROM external_scans WHERE user_id = $1 RETURNING code", userID).Scan(&code)
	if err == nil && code != "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"code": code})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{})
}
