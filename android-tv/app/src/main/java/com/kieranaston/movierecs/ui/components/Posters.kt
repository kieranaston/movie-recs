package com.kieranaston.movierecs.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.BringIntoViewSpec
import androidx.compose.foundation.gestures.LocalBringIntoViewSpec
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Glow
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import coil3.compose.AsyncImage
import com.kieranaston.movierecs.data.Movie
import com.kieranaston.movierecs.data.TmdbImages
import com.kieranaston.movierecs.ui.theme.Dimens
import com.kieranaston.movierecs.ui.theme.Motion
import com.kieranaston.movierecs.ui.theme.Palette

private val PosterShape = RoundedCornerShape(Dimens.CornerRadius)

/**
 * Puts focus back on the card that opened another screen when you come Back.
 * A click only records the key; the screen calls [arm] each time it re-enters composition,
 * and the matching card then takes focus. Saved across navigation via rememberSaveable.
 */
class FocusMemory(private val key: MutableState<String?>, private val armed: MutableState<Boolean>) {
    fun save(k: String) { key.value = k; armed.value = false }
    fun arm() { if (key.value != null) armed.value = true }
    /** Focus [k] as soon as it's on screen (used for a screen's initial focus). */
    fun focus(k: String) { key.value = k; armed.value = true }
    fun shouldRestore(k: String) = armed.value && key.value == k
    fun clear() { key.value = null; armed.value = false }
}

@Composable
fun rememberFocusMemory(): FocusMemory {
    val key = rememberSaveable { mutableStateOf<String?>(null) }
    val armed = rememberSaveable { mutableStateOf(false) }
    val memory = remember(key, armed) { FocusMemory(key, armed) }
    LaunchedEffect(Unit) { memory.arm() } // runs each time the screen comes back
    return memory
}

/**
 * Attach to any clickable: takes focus when [memory] says this [key] should be restored.
 * Call [FocusMemory.save] with the same key when it's clicked.
 */
@Composable
fun Modifier.restoreFocus(memory: FocusMemory, key: String): Modifier {
    val requester = remember { FocusRequester() }
    var focused by remember { mutableStateOf(false) }
    if (memory.shouldRestore(key)) {
        LaunchedEffect(Unit) {
            // Screen transitions can briefly steal focus, so keep asking until it sticks.
            var stable = 0
            for (frame in 0 until 90) {
                withFrameNanos { }
                if (focused) stable++ else { stable = 0; runCatching { requester.requestFocus() } }
                if (stable >= 5) break
            }
            memory.clear()
        }
    }
    return focusRequester(requester).onFocusChanged { focused = it.hasFocus }
}

@Composable
fun PosterCard(
    movie: Movie,
    onClick: () -> Unit,
    focusKey: String,
    memory: FocusMemory,
    modifier: Modifier = Modifier,
) {
    var focused by remember { mutableStateOf(false) }

    Column(modifier) {
        Card(
            onClick = { memory.save(focusKey); onClick() },
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .restoreFocus(memory, focusKey)
                .onFocusChanged { focused = it.hasFocus },
            shape = CardDefaults.shape(PosterShape),
            scale = CardDefaults.scale(focusedScale = Motion.PosterFocusScale),
            border = CardDefaults.border(focusedBorder = Border(BorderStroke(Dimens.FocusBorderWidth, Palette.FocusBorder), shape = PosterShape)),
            // A soft shadow lifts the focused poster off the row (drawn by the platform's shadow renderer).
            glow = CardDefaults.glow(focusedGlow = Glow(elevationColor = Color.Black.copy(alpha = 0.7f), elevation = Dimens.FocusGlow)),
        ) {
            val url = TmdbImages.poster(movie.posterPath)
            if (url != null) {
                AsyncImage(model = url, contentDescription = movie.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            } else {
                Box(Modifier.fillMaxSize().padding(12.dp), contentAlignment = Alignment.Center) {
                    Text(movie.title, style = MaterialTheme.typography.titleSmall, textAlign = TextAlign.Center)
                }
            }
        }
        val titleColor by animateColorAsState(
            if (focused) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            animationSpec = tween(Motion.FocusFadeMillis),
            label = "posterTitle",
        )
        Text(
            movie.title,
            style = MaterialTheme.typography.labelLarge,
            color = titleColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 12.dp),
        )
        MovieMeta(movie.year, movie.voteAverage)
    }
}

/** "2016 · 7.6" */
@Composable
fun MovieMeta(year: Int?, rating: Double?, prefix: String? = null) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        val color = MaterialTheme.colorScheme.onSurfaceVariant
        val style = MaterialTheme.typography.labelMedium
        val parts = listOfNotNull(prefix, year?.toString())
        if (parts.isNotEmpty()) Text(parts.joinToString("  ·  "), style = style, color = color)
        if (rating != null && rating > 0) {
            if (parts.isNotEmpty()) Text("·", style = style, color = color)
            val locale = LocalConfiguration.current.locales[0]
            Text(String.format(locale, "%.1f", rating), style = style, color = color)
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MovieRow(
    title: String,
    movies: List<Movie>,
    onOpen: (Movie) -> Unit,
    focusPrefix: String,
    memory: FocusMemory,
    onNearEnd: (() -> Unit)? = null,
) {
    Column {
        Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(start = Dimens.Gutter))
        // On TV, Compose pivots rows so the focused poster sits ~30% in, which slides the row sideways
        // when you move Up/Down into it; rows here scroll only when needed instead. No focusRestorer
        // either, so Up/Down lands on the poster directly above/below, not the row's last focused one.
        CompositionLocalProvider(LocalBringIntoViewSpec provides ScrollOnlyWhenNeeded) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = Dimens.Gutter, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(Dimens.PosterGap),
            ) {
                itemsIndexed(movies, key = { _, m -> m.tmdbId }) { i, m ->
                    if (onNearEnd != null && i >= movies.size - 6) LaunchedEffect(movies.size) { onNearEnd() }
                    PosterCard(m, { onOpen(m) }, "$focusPrefix:${m.tmdbId}", memory, Modifier.width(Dimens.PosterWidth))
                }
            }
        }
    }
}

/** Scrolls a row only when the focused poster comes within 5% of either edge (room for its focus scale). */
@OptIn(ExperimentalFoundationApi::class)
private val ScrollOnlyWhenNeeded = object : BringIntoViewSpec {
    override fun calculateScrollDistance(offset: Float, size: Float, containerSize: Float): Float {
        val margin = containerSize * 0.05f
        return when {
            offset < margin -> offset - margin
            offset + size > containerSize - margin -> offset + size - (containerSize - margin)
            else -> 0f
        }
    }
}

@Composable
fun MovieGrid(
    movies: List<Movie>,
    onOpen: (Movie) -> Unit,
    focusPrefix: String,
    memory: FocusMemory,
    modifier: Modifier = Modifier,
    onNearEnd: (() -> Unit)? = null,
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(Dimens.PosterWidth),
        modifier = modifier,
        contentPadding = PaddingValues(start = Dimens.Gutter, end = Dimens.Gutter, top = 16.dp, bottom = 48.dp),
        horizontalArrangement = Arrangement.spacedBy(Dimens.PosterGap),
        verticalArrangement = Arrangement.spacedBy(Dimens.GridRowGap),
    ) {
        itemsIndexed(movies, key = { _, m -> m.tmdbId }) { i, m ->
            if (onNearEnd != null && i >= movies.size - 12) LaunchedEffect(movies.size) { onNearEnd() }
            PosterCard(m, { onOpen(m) }, "$focusPrefix:${m.tmdbId}", memory)
        }
    }
}

/** Loading placeholder shaped like a few rows of posters. */
@Composable
fun RowsPlaceholder() {
    Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(32.dp)) {
        repeat(2) {
            Column(Modifier.padding(start = Dimens.Gutter)) {
                Placeholder(Modifier.width(180.dp).padding(bottom = 16.dp).aspectRatio(8f))
                Row(horizontalArrangement = Arrangement.spacedBy(Dimens.PosterGap)) {
                    repeat(7) { Placeholder(Modifier.width(Dimens.PosterWidth).aspectRatio(2f / 3f)) }
                }
            }
        }
    }
}
