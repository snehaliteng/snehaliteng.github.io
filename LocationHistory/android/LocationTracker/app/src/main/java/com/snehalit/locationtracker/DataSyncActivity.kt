package com.snehalit.locationtracker

import android.Manifest
import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.os.Bundle
import android.provider.ContactsContract
import android.provider.Telephony
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class DataSyncActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var syncMessagesBtn: Button
    private lateinit var syncCallsBtn: Button
    private lateinit var syncContactsBtn: Button
    private lateinit var mergeContactsBtn: Button

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val phone: String by lazy {
        getSharedPreferences("tracker", MODE_PRIVATE).getString("phone", "") ?: ""
    }

    companion object {
        private const val PERM_REQ_SMS = 201
        private const val PERM_REQ_CALLS = 202
        private const val PERM_REQ_CONTACTS = 203
        private const val PERM_REQ_WRITE_CONTACTS = 204
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_data_sync)

        statusText = findViewById(R.id.sync_status)
        syncMessagesBtn = findViewById(R.id.sync_messages_btn)
        syncCallsBtn = findViewById(R.id.sync_calls_btn)
        syncContactsBtn = findViewById(R.id.sync_contacts_btn)
        mergeContactsBtn = findViewById(R.id.merge_contacts_btn)

        if (phone.isBlank()) {
            statusText.text = "Not logged in. Go back and sign in first."
            syncMessagesBtn.isEnabled = false
            syncCallsBtn.isEnabled = false
            syncContactsBtn.isEnabled = false
            return
        }

        syncMessagesBtn.setOnClickListener { checkSmsPermission() }
        syncCallsBtn.setOnClickListener { checkCallLogPermission() }
        syncContactsBtn.setOnClickListener { checkContactsPermission() }
        mergeContactsBtn.setOnClickListener { checkWriteContactsPermission() }
    }

    private fun checkSmsPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.READ_SMS), PERM_REQ_SMS)
            return
        }
        syncMessages()
    }

    private fun checkCallLogPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.READ_CALL_LOG), PERM_REQ_CALLS)
            return
        }
        syncCallLog()
    }

    private fun checkContactsPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.READ_CONTACTS), PERM_REQ_CONTACTS)
            return
        }
        syncContacts()
    }

    private fun checkWriteContactsPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.WRITE_CONTACTS), PERM_REQ_WRITE_CONTACTS)
            return
        }
        mergeLocalContacts()
    }

    private fun mergeLocalContacts() {
        mergeContactsBtn.isEnabled = false
        statusText.text = "Merging duplicate contacts on phone..."
        Thread {
            try {
                val nameUri = android.provider.ContactsContract.Data.CONTENT_URI
                val nameProjection = arrayOf(
                    android.provider.ContactsContract.Data.RAW_CONTACT_ID,
                    android.provider.ContactsContract.Data.DISPLAY_NAME
                )
                val nameSelection = android.provider.ContactsContract.Data.MIMETYPE + " = ? AND " + android.provider.ContactsContract.Data.DISPLAY_NAME + " IS NOT NULL"
                val nameArgs = arrayOf(android.provider.ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)

                val rawNames = mutableMapOf<Long, String>()
                contentResolver.query(nameUri, nameProjection, nameSelection, nameArgs, null)?.use { c ->
                    while (c.moveToNext()) {
                        val rawId = c.getLong(0)
                        val name = c.getString(1)?.trim() ?: continue
                        if (name.isEmpty()) continue
                        rawNames[rawId] = name.lowercase()
                    }
                }

                val groups = mutableMapOf<String, MutableList<Long>>()
                rawNames.forEach { (rawId, name) -> groups.getOrPut(name) { mutableListOf() }.add(rawId) }

                var deleted = 0
                for ((_, ids) in groups) {
                    if (ids.size < 2) continue
                    for (i in 1 until ids.size) {
                        val uri = ContentUris.withAppendedId(android.provider.ContactsContract.RawContacts.CONTENT_URI, ids[i])
                        contentResolver.delete(uri, null, null)
                        deleted++
                    }
                }

                val finalDeleted = deleted
                runOnUiThread {
                    statusText.text = "Merged $finalDeleted duplicate contact${if (finalDeleted == 1) "" else "s"} on phone. Re-syncing..."
                    mergeContactsBtn.isEnabled = true
                }
                if (finalDeleted > 0) syncContacts()
            } catch (e: Exception) {
                runOnUiThread { statusText.text = "Error: " + e.message; mergeContactsBtn.isEnabled = true }
            }
        }.start()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
        when (requestCode) {
            PERM_REQ_SMS -> if (granted) syncMessages() else Toast.makeText(this, "SMS permission required", Toast.LENGTH_SHORT).show()
            PERM_REQ_CALLS -> if (granted) syncCallLog() else Toast.makeText(this, "Call log permission required", Toast.LENGTH_SHORT).show()
            PERM_REQ_CONTACTS -> if (granted) syncContacts() else Toast.makeText(this, "Contacts permission required", Toast.LENGTH_SHORT).show()
            PERM_REQ_WRITE_CONTACTS -> if (granted) mergeLocalContacts() else Toast.makeText(this, "Write contacts permission required to merge", Toast.LENGTH_SHORT).show()
        }
    }

    private fun syncMessages() {
        syncMessagesBtn.isEnabled = false
        statusText.text = "Reading SMS..."
        Thread {
            try {
                val messages = readSms()
                if (messages.length() == 0) {
                    runOnUiThread { statusText.text = "No SMS found on device."; syncMessagesBtn.isEnabled = true }
                    return@Thread
                }
                statusText.text = "Uploading " + messages.length() + " messages..."
                val result = pushToFunction("push-messages", mapOf("phone" to phone, "messages" to messages))
                runOnUiThread {
                    statusText.text = if (result != null) "Synced " + result + " messages successfully!" else "Upload failed"
                    syncMessagesBtn.isEnabled = true
                }
            } catch (e: Exception) {
                runOnUiThread { statusText.text = "Error: " + e.message; syncMessagesBtn.isEnabled = true }
            }
        }.start()
    }

    private fun syncCallLog() {
        syncCallsBtn.isEnabled = false
        statusText.text = "Reading call log..."
        Thread {
            try {
                val calls = readCallLog()
                if (calls.length() == 0) {
                    runOnUiThread { statusText.text = "No call logs found."; syncCallsBtn.isEnabled = true }
                    return@Thread
                }
                statusText.text = "Uploading " + calls.length() + " calls..."
                val result = pushToFunction("push-calls", mapOf("phone" to phone, "calls" to calls))
                runOnUiThread {
                    statusText.text = if (result != null) "Synced " + result + " calls successfully!" else "Upload failed"
                    syncCallsBtn.isEnabled = true
                }
            } catch (e: Exception) {
                runOnUiThread { statusText.text = "Error: " + e.message; syncCallsBtn.isEnabled = true }
            }
        }.start()
    }

    private fun syncContacts() {
        syncContactsBtn.isEnabled = false
        statusText.text = "Reading contacts..."
        Thread {
            try {
                val contacts = readContacts()
                if (contacts.length() == 0) {
                    runOnUiThread { statusText.text = "No contacts found."; syncContactsBtn.isEnabled = true }
                    return@Thread
                }
                statusText.text = "Uploading " + contacts.length() + " contacts..."
                val result = pushToFunction("push-contacts", mapOf("phone" to phone, "contacts" to contacts))
                runOnUiThread {
                    statusText.text = if (result != null) "Synced " + result + " contacts successfully!" else "Upload failed"
                    syncContactsBtn.isEnabled = true
                }
            } catch (e: Exception) {
                runOnUiThread { statusText.text = "Error: " + e.message; syncContactsBtn.isEnabled = true }
            }
        }.start()
    }

    private fun readSms(): JSONArray {
        val arr = JSONArray()
        val cursor: Cursor? = contentResolver.query(
            Telephony.Sms.CONTENT_URI,
            null, null, null,
            Telephony.Sms.DATE + " DESC"
        )
        cursor?.use { c ->
            var count = 0
            while (c.moveToNext() && count < 1000) {
                val body = getCol(c, Telephony.Sms.BODY) ?: continue
                val address = getCol(c, Telephony.Sms.ADDRESS) ?: ""
                val type = getCol(c, Telephony.Sms.TYPE) ?: ""
                val date = getCol(c, Telephony.Sms.DATE) ?: "0"
                val ts = try { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date(date.toLong())) } catch (e: Exception) { java.time.Instant.now().toString() }
                arr.put(JSONObject().apply {
                    put("body", body)
                    put("address", address)
                    put("type", if (type == "1") "inbox" else if (type == "2") "sent" else type)
                    put("source", "sms")
                    put("timestamp", ts)
                })
                count++
            }
        }
        return arr
    }

    private fun readCallLog(): JSONArray {
        val arr = JSONArray()
        val cursor: Cursor? = contentResolver.query(
            android.provider.CallLog.Calls.CONTENT_URI,
            null, null, null,
            android.provider.CallLog.Calls.DATE + " DESC"
        )
        cursor?.use { c ->
            var count = 0
            while (c.moveToNext() && count < 500) {
                val number = getCol(c, android.provider.CallLog.Calls.NUMBER) ?: ""
                val name = getCol(c, android.provider.CallLog.Calls.CACHED_NAME) ?: ""
                val type = getCol(c, android.provider.CallLog.Calls.TYPE) ?: "0"
                val duration = getCol(c, android.provider.CallLog.Calls.DURATION) ?: "0"
                val date = getCol(c, android.provider.CallLog.Calls.DATE) ?: "0"
                val ts = try { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date(date.toLong())) } catch (e: Exception) { java.time.Instant.now().toString() }
                val typeStr = when (type) {
                    "1" -> "incoming"
                    "2" -> "outgoing"
                    "3" -> "missed"
                    else -> "unknown"
                }
                arr.put(JSONObject().apply {
                    put("number", number)
                    put("name", name)
                    put("type", typeStr)
                    put("duration", try { duration.toInt() } catch (e: Exception) { 0 })
                    put("timestamp", ts)
                })
                count++
            }
        }
        return arr
    }

    private fun readContacts(): JSONArray {
        val arr = JSONArray()
        val seen = mutableSetOf<String>()
        val cursor: Cursor? = contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.SORT_KEY_PRIMARY
            ),
            null, null,
            ContactsContract.CommonDataKinds.Phone.SORT_KEY_PRIMARY + " ASC"
        )
        cursor?.use { c ->
            while (c.moveToNext()) {
                val name = getCol(c, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME) ?: ""
                val number = getCol(c, ContactsContract.CommonDataKinds.Phone.NUMBER) ?: ""
                if (number.isBlank()) continue
                val key = name + "|" + number
                if (key in seen) continue
                seen.add(key)
                arr.put(JSONObject().apply {
                    put("name", name)
                    put("number", number)
                    put("email", "")
                })
            }
        }
        return arr
    }

    private fun getCol(c: Cursor, col: String): String? {
        val idx = c.getColumnIndex(col)
        return if (idx >= 0) c.getString(idx) else null
    }

    private fun pushToFunction(functionName: String, body: Map<String, Any>): Int? {
        val json = JSONObject(body)
        android.util.Log.d("DataSync", "Pushing to $functionName: " + json.toString().take(500))
        val requestBody = json.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(LocationService.SUPABASE_FUNCTION_URL.replace("push-location", functionName))
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .addHeader("Authorization", "Bearer " + LocationService.SUPABASE_ANON_KEY)
            .build()

        client.newCall(request).execute().use { response ->
            val respBody = response.body?.string() ?: "{}"
            android.util.Log.d("DataSync", "$functionName response (" + response.code + "): " + respBody.take(500))
            if (!response.isSuccessful) {
                android.util.Log.e("DataSync", "$functionName failed: " + respBody)
                return null
            }
            val j = JSONObject(respBody)
            return j.optInt("inserted", 0)
        }
    }
}
