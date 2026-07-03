package com.snehalit.locationtracker

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object QueueManager {

    private const val FILE_NAME = "pending_locations.json"

    @Synchronized
    fun enqueue(context: android.content.Context, json: JSONObject) {
        val queue = load(context)
        queue.put(json)
        save(context, queue)
    }

    @Synchronized
    fun flush(context: android.content.Context, client: OkHttpClient, url: String, apiKey: String): Int {
        val queue = load(context)
        if (queue.length() == 0) return 0

        val remaining = JSONArray()
        var pushed = 0

        for (i in 0 until queue.length()) {
            val item = queue.getJSONObject(i)
            try {
                val body = item.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url(url)
                    .post(body)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $apiKey")
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        pushed++
                    } else {
                        val respBody = response.body?.string() ?: ""
                        if (respBody.contains("too_close") || respBody.contains("inserted\":false")) {
                            pushed++
                        } else {
                            remaining.put(item)
                        }
                    }
                }
            } catch (e: Exception) {
                remaining.put(item)
            }
        }

        save(context, remaining)
        return pushed
    }

    @Synchronized
    fun count(context: android.content.Context): Int {
        return load(context).length()
    }

    private fun load(context: android.content.Context): JSONArray {
        return try {
            val file = File(context.filesDir, FILE_NAME)
            if (file.exists()) JSONArray(file.readText()) else JSONArray()
        } catch (e: Exception) {
            JSONArray()
        }
    }

    private fun save(context: android.content.Context, array: JSONArray) {
        val file = File(context.filesDir, FILE_NAME)
        file.writeText(array.toString())
    }
}
