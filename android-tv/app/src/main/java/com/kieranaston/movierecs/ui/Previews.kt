package com.kieranaston.movierecs.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Devices
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import com.kieranaston.movierecs.data.Movie
import com.kieranaston.movierecs.data.MovieDetail
import com.kieranaston.movierecs.ui.components.MovieRow
import com.kieranaston.movierecs.ui.components.PosterCard
import com.kieranaston.movierecs.ui.components.rememberFocusMemory
import com.kieranaston.movierecs.ui.details.DetailsContent
import com.kieranaston.movierecs.ui.genres.GenreTile
import com.kieranaston.movierecs.ui.theme.Dimens
import com.kieranaston.movierecs.ui.theme.MovieTheme

// Android Studio previews with sample data — handy for tweaking ui/theme/Theme.kt without running the app.
// (Posters are blank in previews because images load from the network.)

private val sampleMovies = listOf(
    Movie(155, "The Dark Knight", 2008, null, 8.5),
    Movie(157336, "Interstellar", 2014, null, 8.5),
    Movie(496243, "Parasite", 2019, null, 8.5),
    Movie(27205, "Inception", 2010, null, 8.4),
    Movie(129, "Spirited Away", 2001, null, 8.5),
    Movie(680, "Pulp Fiction", 1994, null, 8.5),
)

private val sampleDetail = MovieDetail(
    tmdbId = 329865,
    title = "Arrival",
    tagline = "Why are they here?",
    overview = "Taking place after alien crafts land around the world, an expert linguist is recruited by the " +
        "military to determine whether they come in peace or are a threat.",
    year = 2016,
    runtime = 116,
    voteAverage = 7.6,
    genres = listOf("Drama", "Science Fiction", "Mystery"),
)

@Composable
private fun Frame(content: @Composable () -> Unit) {
    MovieTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            colors = SurfaceDefaults.colors(
                containerColor = MaterialTheme.colorScheme.background,
                contentColor = MaterialTheme.colorScheme.onBackground,
            ),
        ) { content() }
    }
}

@Preview(name = "Poster", widthDp = 200, heightDp = 300)
@Composable
private fun PosterPreview() = Frame {
    PosterCard(sampleMovies[0], onClick = {}, focusKey = "p", memory = rememberFocusMemory(), modifier = Modifier.padding(24.dp).width(Dimens.PosterWidth))
}

@Preview(name = "Row", device = Devices.TV_1080p)
@Composable
private fun RowPreview() = Frame {
    MovieRow("Top Rated", sampleMovies, onOpen = {}, focusPrefix = "r", memory = rememberFocusMemory())
}

@Preview(name = "Genre tiles", widthDp = 960, heightDp = 160)
@Composable
private fun GenreTilesPreview() = Frame {
    Row(Modifier.padding(Dimens.Gutter), horizontalArrangement = Arrangement.spacedBy(Dimens.PosterGap)) {
        listOf("Action", "Comedy", "Horror", "Science Fiction").forEach {
            GenreTile(it, onClick = {}, modifier = Modifier.width(200.dp))
        }
    }
}

@Preview(name = "Details", device = Devices.TV_1080p)
@Composable
private fun DetailsPreview() = Frame {
    DetailsContent(sampleDetail, inWatchlist = false, onToggleWatchlist = {})
}
