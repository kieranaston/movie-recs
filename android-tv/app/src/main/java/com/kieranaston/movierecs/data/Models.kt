package com.kieranaston.movierecs.data

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
    val directors: List<String> = emptyList(),
    val cast: List<CastMember> = emptyList(),
) {
    fun toMovie() = Movie(tmdbId, title, year, posterPath, voteAverage)
}

@Serializable
data class CastMember(val name: String, val character: String? = null, val profilePath: String? = null)

/** TMDB image CDN — public, no key needed. */
object TmdbImages {
    private const val BASE = "https://image.tmdb.org/t/p"
    fun poster(path: String?) = path?.let { "$BASE/w342$it" }
    fun backdrop(path: String?) = path?.let { "$BASE/w1280$it" }
}
