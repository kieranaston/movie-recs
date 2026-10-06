package com.kieranaston.movierecs.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Mirrors the JSON from the website's /api/v1 routes (src/app/api/v1 in the web project).

@Serializable
data class Movie(
    val tmdbId: Int,
    val title: String,
    val year: Int? = null,
    val posterPath: String? = null,
    val voteAverage: Double? = null,
)

@Serializable
data class Genre(val slug: String, val name: String, val filters: List<String> = emptyList())

@Serializable
data class GenresResponse(val genres: List<Genre>)

@Serializable
data class Section(val id: String, val label: String, val total: Int, val movies: List<Movie>)

@Serializable
data class BrowseResponse(
    val mode: String,
    val sections: List<Section> = emptyList(),
    val movies: List<Movie> = emptyList(),
    val total: Int = 0,
)

@Serializable
data class MoviePage(val movies: List<Movie>, val total: Int = 0)

@Serializable
data class SearchResponse(val movies: List<Movie>, val page: Int, val totalPages: Int)

@Serializable
data class Provider(val name: String, val logoPath: String? = null)

@Serializable
data class Providers(
    val stream: List<Provider> = emptyList(),
    val free: List<Provider> = emptyList(),
    val rent: List<Provider> = emptyList(),
    val buy: List<Provider> = emptyList(),
) {
    val isEmpty get() = stream.isEmpty() && free.isEmpty() && rent.isEmpty() && buy.isEmpty()
}

@Serializable
data class MovieDetail(
    val tmdbId: Int,
    val title: String,
    val tagline: String? = null,
    val overview: String? = null,
    val year: Int? = null,
    val runtime: Int? = null,
    val voteAverage: Double? = null,
    val voteCount: Int = 0,
    val genres: List<String> = emptyList(),
    val posterPath: String? = null,
    val backdropPath: String? = null,
    val trailerKey: String? = null,
    val providers: Providers = Providers(),
) {
    fun toMovie() = Movie(tmdbId, title, year, posterPath, voteAverage)
}

/** TMDB image CDN — public, no key needed. */
object TmdbImages {
    private const val BASE = "https://image.tmdb.org/t/p"
    fun poster(path: String?) = path?.let { "$BASE/w342$it" }
    fun backdrop(path: String?) = path?.let { "$BASE/w1280$it" }
    fun logo(path: String?) = path?.let { "$BASE/w92$it" }
}

// ---------- Auth (RFC 8628 device flow, served by Better Auth at /api/auth) ----------

@Serializable
data class DeviceCode(
    @SerialName("device_code") val deviceCode: String,
    @SerialName("user_code") val userCode: String,
    @SerialName("verification_uri") val verificationUri: String,
    @SerialName("verification_uri_complete") val verificationUriComplete: String,
    @SerialName("expires_in") val expiresIn: Int,
    val interval: Int = 5,
)

@Serializable
data class OAuthError(val error: String, @SerialName("error_description") val description: String? = null)

@Serializable
data class TokenGrant(@SerialName("access_token") val accessToken: String)

@Serializable
data class Me(val email: String, val name: String = "")
