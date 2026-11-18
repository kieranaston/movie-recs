package com.kieranaston.movierecs.ui.details

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.Button
import androidx.tv.material3.ButtonDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Text
import coil3.compose.AsyncImage
import com.kieranaston.movierecs.data.Api
import com.kieranaston.movierecs.data.MovieDetail
import com.kieranaston.movierecs.data.TmdbImages
import com.kieranaston.movierecs.ui.components.AppIcons
import com.kieranaston.movierecs.ui.components.ErrorState
import com.kieranaston.movierecs.ui.components.Load
import com.kieranaston.movierecs.ui.components.MovieMeta
import com.kieranaston.movierecs.ui.components.Placeholder
import com.kieranaston.movierecs.ui.components.app
import com.kieranaston.movierecs.ui.components.load
import com.kieranaston.movierecs.ui.theme.Dimens
import kotlinx.coroutines.launch

class DetailsViewModel(private val api: Api, private val tmdbId: Int) : ViewModel() {
    var detail by mutableStateOf<Load<MovieDetail>>(Load.Loading)
        private set

    init { load() }

    fun load() {
        detail = Load.Loading
        viewModelScope.launch { detail = load { api.movie(tmdbId) } }
    }
}

/** Stateful entry point: loads the movie and wires the watchlist and trailer actions. */
@Composable
fun DetailsScreen(tmdbId: Int, onPlayTrailer: (String) -> Unit) {
    val app = app()
    val vm = viewModel(key = "movie:$tmdbId") { DetailsViewModel(app.api, tmdbId) }
    val watchlist by app.watchlist.state.collectAsStateWithLifecycle()

    when (val d = vm.detail) {
        Load.Loading -> DetailsPlaceholder()
        Load.Failed -> ErrorState(onRetry = vm::load, message = "Couldn't load this movie.")
        is Load.Ready -> DetailsContent(
            movie = d.value,
            inWatchlist = app.watchlist.contains(watchlist, tmdbId),
            onToggleWatchlist = { app.watchlist.toggle(d.value.toMovie()) },
            onPlayTrailer = onPlayTrailer,
        )
    }
}

/** Pure UI for a loaded movie — no data access, so it renders in previews. */
@Composable
fun DetailsContent(
    movie: MovieDetail,
    inWatchlist: Boolean,
    onToggleWatchlist: () -> Unit,
    onPlayTrailer: (String) -> Unit,
) {
    val primary = remember { FocusRequester() }
    var expanded by remember(movie.tmdbId) { mutableStateOf(false) }
    val background = MaterialTheme.colorScheme.background

    Box(Modifier.fillMaxSize()) {
        AsyncImage(
            model = TmdbImages.backdrop(movie.backdropPath),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        // Scrims keep text readable over any backdrop.
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(0f to background, 0.45f to background.copy(alpha = 0.85f), 1f to Color.Transparent)))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.5f to Color.Transparent, 1f to background)))

        Column(
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(0.58f)
                .padding(start = Dimens.Gutter, top = 56.dp, bottom = Dimens.TopInset),
        ) {
            Text(movie.title, style = MaterialTheme.typography.displaySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(12.dp))
            MovieMeta(movie.year, movie.voteAverage, prefix = movie.runtime?.let(::formatRuntime))
            if (movie.genres.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text(movie.genres.joinToString("  ·  "), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            movie.tagline?.let {
                Spacer(Modifier.height(16.dp))
                Text(it, style = MaterialTheme.typography.titleSmall, fontStyle = FontStyle.Italic, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(12.dp))
            Text(
                movie.overview ?: "No overview available.",
                style = MaterialTheme.typography.bodyLarge,
                maxLines = if (expanded) Int.MAX_VALUE else 3,
                overflow = TextOverflow.Ellipsis,
            )
            if (!expanded) Credits(movie)

            Spacer(Modifier.height(24.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                movie.trailerKey?.let { key ->
                    Button(onClick = { onPlayTrailer(key) }, modifier = Modifier.focusRequester(primary)) {
                        Icon(AppIcons.Play, contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
                        Spacer(Modifier.width(ButtonDefaults.IconSpacing))
                        Text("Trailer")
                    }
                }
                OutlinedButton(
                    onClick = onToggleWatchlist,
                    modifier = if (movie.trailerKey == null) Modifier.focusRequester(primary) else Modifier,
                ) {
                    Icon(if (inWatchlist) AppIcons.Check else AppIcons.Add, contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
                    Spacer(Modifier.width(ButtonDefaults.IconSpacing))
                    Text(if (inWatchlist) "In Watchlist" else "Add to Watchlist")
                }
                if ((movie.overview?.length ?: 0) > LONG_OVERVIEW) {
                    OutlinedButton(onClick = { expanded = !expanded }) {
                        Text(if (expanded) "Less" else "More")
                    }
                }
            }
        }
    }
    LaunchedEffect(movie.tmdbId) { runCatching { primary.requestFocus() } }
}

/** Overviews longer than this (about three lines) get a More/Less button. */
private const val LONG_OVERVIEW = 200

/** "Directed by …" and the top-billed cast, as on the website's movie page. */
@Composable
private fun Credits(movie: MovieDetail) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    @Composable
    fun line(label: String, names: List<String>) {
        if (names.isEmpty()) return
        Spacer(Modifier.height(8.dp))
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(color = muted)) { append("$label  ") }
                append(names.joinToString(", "))
            },
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
    if (movie.directors.isNotEmpty() || movie.cast.isNotEmpty()) Spacer(Modifier.height(4.dp))
    line("Directed by", movie.directors)
    line("Starring", movie.cast.take(6).map { it.name })
}

/** 116 → "1h 56m", 45 → "45m". */
private fun formatRuntime(minutes: Int) = if (minutes >= 60) "${minutes / 60}h ${minutes % 60}m" else "${minutes}m"

@Composable
private fun DetailsPlaceholder() {
    Column(Modifier.padding(start = Dimens.Gutter, top = 56.dp)) {
        Placeholder(Modifier.width(420.dp).height(44.dp))
        Spacer(Modifier.height(16.dp))
        Placeholder(Modifier.width(220.dp).height(16.dp))
        Spacer(Modifier.height(24.dp))
        repeat(3) { Placeholder(Modifier.width(520.dp).height(16.dp).padding(bottom = 6.dp)) }
    }
}
