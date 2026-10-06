package com.kieranaston.movierecs.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/** Outcome of one poll of the token endpoint (RFC 8628 §3.5). */
sealed interface PollResult {
    data class Granted(val token: String) : PollResult
    data object Pending : PollResult
    data object SlowDown : PollResult
    data object Denied : PollResult
    data object Expired : PollResult // expired_token or invalid_grant: start over with a new code
}

/** The TV side of sign-in. An interface so the flow can be tested with a fake. */
interface DeviceAuth {
    suspend fun requestCode(): DeviceCode
    suspend fun poll(deviceCode: String): PollResult
    suspend fun me(token: String): Me
    suspend fun signOut(token: String)
}

class HttpDeviceAuth(baseUrl: String, private val http: OkHttpClient) : DeviceAuth {
    private val base = baseUrl.toHttpUrl()
    private val json = Json { ignoreUnknownKeys = true }
    private val jsonType = "application/json".toMediaType()

    override suspend fun requestCode(): DeviceCode =
        post("api/auth/device/code", buildJsonObject { put("client_id", CLIENT_ID) }.toString()).let { (code, body) ->
            if (code != 200) throw ApiException(code)
            json.decodeFromString(body)
        }

    override suspend fun poll(deviceCode: String): PollResult {
        val (code, body) = post(
            "api/auth/device/token",
            buildJsonObject {
                put("grant_type", "urn:ietf:params:oauth:grant-type:device_code")
                put("device_code", deviceCode)
                put("client_id", CLIENT_ID)
            }.toString(),
        )
        if (code == 200) return PollResult.Granted(json.decodeFromString<TokenGrant>(body).accessToken)
        val error = runCatching { json.decodeFromString<OAuthError>(body).error }.getOrNull()
        return when (error) {
            "authorization_pending" -> PollResult.Pending
            "slow_down" -> PollResult.SlowDown
            "access_denied" -> PollResult.Denied
            "expired_token", "invalid_grant" -> PollResult.Expired
            else -> throw ApiException(code)
        }
    }

    override suspend fun me(token: String): Me = withContext(Dispatchers.IO) {
        val request = Request.Builder().url(base.resolve("api/v1/me")!!).header("Authorization", "Bearer $token").build()
        http.newCall(request).execute().use { res ->
            if (!res.isSuccessful) throw ApiException(res.code)
            json.decodeFromString(res.body.string())
        }
    }

    override suspend fun signOut(token: String) {
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(base.resolve("api/auth/sign-out")!!)
                .header("Authorization", "Bearer $token")
                .post("{}".toRequestBody(jsonType))
                .build()
            http.newCall(request).execute().close()
        }
    }

    private suspend fun post(path: String, body: String): Pair<Int, String> = withContext(Dispatchers.IO) {
        val request = Request.Builder().url(base.resolve(path)!!).post(body.toRequestBody(jsonType)).build()
        http.newCall(request).execute().use { it.code to it.body.string() }
    }

    companion object {
        /** Must match TV_CLIENT_ID on the server; it is an identifier, not a secret. */
        const val CLIENT_ID = "movie-recs-tv"
    }
}
