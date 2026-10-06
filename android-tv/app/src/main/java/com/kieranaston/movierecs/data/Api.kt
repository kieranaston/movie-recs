package com.kieranaston.movierecs.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class ApiException(val code: Int) : Exception("HTTP $code")

/**
 * Client for the website's /api/v1, authenticated as the signed-in user.
 * The token comes from [SessionRepository]; a 401 signs the TV out (e.g. revoked from the website).
 */
class Api(
    baseUrl: String,
    private val http: OkHttpClient,
    private val token: () -> String?,
    private val onUnauthorized: () -> Unit,
) {
    private val base = baseUrl.toHttpUrl()
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun genres(): GenresResponse = get("genres")

    suspend fun browse(genre: String?, filter: String?, offset: Int = 0, limit: Int = 20): BrowseResponse =
        get("browse", "genre" to genre, "filter" to filter, "offset" to offset, "limit" to limit)

    suspend fun section(id: String, genre: String?, offset: Int, limit: Int = 20): MoviePage =
        get("browse/section", "section" to id, "genre" to genre, "offset" to offset, "limit" to limit)

    suspend fun search(query: String, page: Int = 1): SearchResponse = get("search", "q" to query, "page" to page)

    suspend fun movie(tmdbId: Int): MovieDetail = get("movies/$tmdbId")

    suspend fun watchlist(): List<Movie> = get<MoviePage>("watchlist").movies

    suspend fun addToWatchlist(tmdbId: Int) = send("PUT", "watchlist/$tmdbId")

    suspend fun removeFromWatchlist(tmdbId: Int) = send("DELETE", "watchlist/$tmdbId")

    private fun url(path: String, query: Array<out Pair<String, Any?>>): HttpUrl =
        base.newBuilder().addPathSegments("api/v1/$path").apply {
            for ((k, v) in query) if (v != null) addQueryParameter(k, v.toString())
        }.build()

    private suspend inline fun <reified T> get(path: String, vararg query: Pair<String, Any?>): T {
        val body = execute(Request.Builder().url(url(path, query)).get())
        return json.decodeFromString(body)
    }

    private suspend fun send(method: String, path: String) {
        execute(Request.Builder().url(url(path, emptyArray())).method(method, if (method == "PUT") ByteArray(0).toRequestBody(null) else null))
    }

    private suspend fun execute(builder: Request.Builder): String = withContext(Dispatchers.IO) {
        val bearer = token() ?: run {
            onUnauthorized()
            throw ApiException(401)
        }
        val request = builder.header("Authorization", "Bearer $bearer").header("Accept", "application/json").build()
        http.newCall(request).execute().use { res ->
            if (res.code == 401) onUnauthorized()
            if (!res.isSuccessful) throw ApiException(res.code)
            res.body.string()
        }
    }
}
