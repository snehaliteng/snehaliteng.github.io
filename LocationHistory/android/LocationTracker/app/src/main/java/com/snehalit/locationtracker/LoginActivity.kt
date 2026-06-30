package com.snehalit.locationtracker

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class LoginActivity : AppCompatActivity() {

    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var errorText: TextView
    private lateinit var loginBtn: Button
    private lateinit var signupBtn: Button
    private lateinit var googleBtn: Button

    private val supabaseUrl = "https://vgipghqejzbcoighktij.supabase.co"
    private val supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaXBnaHFlanpiY29pZ2hrdGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjQ2MjIsImV4cCI6MjA5NTMwMDYyMn0.KoDwAZarGWOLwKXOwycA8wuIiIrksvZy7dyaO0-ehUo"

    private var googleOAuthInProgress = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        emailInput = findViewById(R.id.login_email)
        passwordInput = findViewById(R.id.login_password)
        errorText = findViewById(R.id.login_error)
        loginBtn = findViewById(R.id.login_btn)
        signupBtn = findViewById(R.id.signup_btn)
        googleBtn = findViewById(R.id.google_btn)

        loginBtn.setOnClickListener { login() }
        signupBtn.setOnClickListener { signup() }
        googleBtn.setOnClickListener { signInWithGoogle() }

        // Handle deep link from Google OAuth (cold start)
        handleOAuthRedirect(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Handle deep link from Google OAuth (warm start - app was already running)
        handleOAuthRedirect(intent)
    }

    private fun handleOAuthRedirect(intent: Intent?) {
        val data: Uri? = intent?.data
        if (data != null && data.scheme == "locationtracker" && data.host == "auth" && data.path == "/callback") {
            googleOAuthInProgress = false
            val fragment = data.encodedFragment ?: ""
            val params = fragment.split("&").associate {
                val parts = it.split("=", limit = 2)
                if (parts.size == 2) parts[0] to Uri.decode(parts[1]) else parts[0] to ""
            }
            val accessToken = params["access_token"]
            if (!accessToken.isNullOrBlank()) {
                Thread { exchangeGoogleToken(accessToken) }.start()
            } else {
                showError("Google sign-in failed: no access token")
            }
        }
    }

    private fun signInWithGoogle() {
        googleOAuthInProgress = true
        googleBtn.isEnabled = false
        googleBtn.text = "Opening Google..."

        // Clear error text
        errorText.visibility = android.view.View.GONE

        val authorizeUrl = "$supabaseUrl/auth/v1/authorize?provider=google" +
                "&redirect_to=locationtracker://auth/callback" +
                "&response_type=token" +
                "&scopes=email+profile"

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(authorizeUrl))
        startActivity(intent)
    }

    private fun exchangeGoogleToken(accessToken: String) {
        try {
            val url = URL("$supabaseUrl/auth/v1/user")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $accessToken")
            conn.setRequestProperty("apikey", supabaseAnonKey)

            val code = conn.responseCode
            val responseText = if (code in 200..299) {
                conn.inputStream.bufferedReader().readText()
            } else {
                conn.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
            }
            conn.disconnect()

            if (code != 200) {
                runOnUiThread { showError("Failed to get user info ($code)") }
                return
            }

            val json = JSONObject(responseText)
            val email = json.optString("email", "")
            if (email.isBlank()) {
                runOnUiThread { showError("Could not get email from Google account") }
                return
            }

            getSharedPreferences("tracker", MODE_PRIVATE).edit()
                .putString("phone", email)
                .apply()

            runOnUiThread {
                val intent = Intent(this, MainActivity::class.java).apply {
                    putExtra("phone", email)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
                startActivity(intent)
            }

        } catch (e: Exception) {
            runOnUiThread { showError("Network error: ${e.message}") }
        }
    }

    private fun login() {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString()
        if (email.isBlank() || password.isBlank()) {
            showError("Enter email and password")
            return
        }
        errorText.visibility = android.view.View.GONE
        loginBtn.isEnabled = false
        loginBtn.text = "Signing in..."
        Thread { doLogin(email, password) }.start()
    }

    private fun signup() {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString()
        if (email.isBlank() || password.length < 6) {
            showError("Enter email and password (min 6 chars)")
            return
        }
        errorText.visibility = android.view.View.GONE
        signupBtn.isEnabled = false
        signupBtn.text = "Signing up..."
        Thread { doSignup(email, password) }.start()
    }

    private fun doLogin(email: String, password: String) {
        try {
            val url = URL("$supabaseUrl/auth/v1/token?grant_type=password")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", supabaseAnonKey)
            conn.doOutput = true

            val body = JSONObject().apply {
                put("email", email)
                put("password", password)
            }
            val writer = OutputStreamWriter(conn.outputStream)
            writer.write(body.toString())
            writer.flush()
            writer.close()

            val code = conn.responseCode
            val responseText = if (code in 200..299) {
                conn.inputStream.bufferedReader().readText()
            } else {
                conn.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
            }
            conn.disconnect()

            if (code != 200) {
                val msg = if (responseText.contains("Invalid login credentials")) {
                    "Invalid email or password"
                } else {
                    "Login failed ($code)"
                }
                runOnUiThread { showError(msg) }
                return
            }

            val json = JSONObject(responseText)
            val userEmail = json.getJSONObject("user").optString("email", email)

            getSharedPreferences("tracker", MODE_PRIVATE).edit()
                .putString("phone", userEmail)
                .apply()

            runOnUiThread {
                val intent = Intent(this, MainActivity::class.java).apply {
                    putExtra("phone", userEmail)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
                startActivity(intent)
            }

        } catch (e: Exception) {
            runOnUiThread { showError("Network error: ${e.message}") }
        }
    }

    private fun doSignup(email: String, password: String) {
        try {
            val url = URL("$supabaseUrl/auth/v1/signup")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", supabaseAnonKey)
            conn.doOutput = true

            val body = JSONObject().apply {
                put("email", email)
                put("password", password)
            }
            val writer = OutputStreamWriter(conn.outputStream)
            writer.write(body.toString())
            writer.flush()
            writer.close()

            val code = conn.responseCode
            val responseText = if (code in 200..299) {
                conn.inputStream.bufferedReader().readText()
            } else {
                conn.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
            }
            conn.disconnect()

            if (code == 400 && responseText.contains("User already registered")) {
                runOnUiThread {
                    showError("User already exists. Try signing in.")
                    signupBtn.isEnabled = true
                    signupBtn.text = "Sign Up"
                }
                return
            }

            if (code != 200) {
                runOnUiThread {
                    showError("Sign up failed ($code)")
                    signupBtn.isEnabled = true
                    signupBtn.text = "Sign Up"
                }
                return
            }

            val json = JSONObject(responseText)
            val userEmail = json.getJSONObject("user").optString("email", email)

            if (json.has("access_token")) {
                getSharedPreferences("tracker", MODE_PRIVATE).edit()
                    .putString("phone", userEmail)
                    .apply()

                runOnUiThread {
                    Toast.makeText(this, "Account created!", Toast.LENGTH_SHORT).show()
                    val intent = Intent(this, MainActivity::class.java).apply {
                        putExtra("phone", userEmail)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    }
                    startActivity(intent)
                }
            } else {
                runOnUiThread {
                    Toast.makeText(this, "Check your email for the confirmation link!", Toast.LENGTH_LONG).show()
                    signupBtn.isEnabled = true
                    signupBtn.text = "Sign Up"
                }
            }

        } catch (e: Exception) {
            runOnUiThread {
                showError("Network error: ${e.message}")
                signupBtn.isEnabled = true
                signupBtn.text = "Sign Up"
            }
        }
    }

    private fun showError(msg: String) {
        errorText.text = msg
        errorText.visibility = android.view.View.VISIBLE
        loginBtn.isEnabled = true
        loginBtn.text = "Sign In"
        signupBtn.isEnabled = true
        signupBtn.text = "Sign Up"
        googleBtn.isEnabled = true
        googleBtn.text = "  Sign in with Google"
        googleOAuthInProgress = false
    }
}
