package com.kieranaston.movierecs.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.foundation.focusGroup
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Tab
import androidx.tv.material3.TabRow
import androidx.tv.material3.Text
import com.kieranaston.movierecs.data.Genre
import com.kieranaston.movierecs.data.Movie
import com.kieranaston.movierecs.ui.about.AboutScreen
import com.kieranaston.movierecs.ui.browse.BrowseContent
import com.kieranaston.movierecs.ui.browse.BrowseViewModel
import com.kieranaston.movierecs.ui.components.app
import com.kieranaston.movierecs.ui.components.rememberFocusMemory
import com.kieranaston.movierecs.ui.genres.GenresScreen
import com.kieranaston.movierecs.ui.search.SearchScreen
import com.kieranaston.movierecs.ui.theme.Dimens
import com.kieranaston.movierecs.ui.watchlist.WatchlistScreen

private enum class TopTab(val label: String) { Home("Home"), Genres("Genres"), Search("Search"), Watchlist("Watchlist"), Account("Account") }

/** Top-level tabs. Back from content jumps to the tabs; Back on a tab returns to Home; Back on Home exits. */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun MainScreen(onOpenMovie: (Movie) -> Unit, onOpenGenre: (Genre) -> Unit) {
    var tab by rememberSaveable { mutableStateOf(TopTab.Home) }
    var tabsFocused by remember { mutableStateOf(false) }
    var initialFocusDone by rememberSaveable { mutableStateOf(false) }
    val tabFocus = remember { TopTab.entries.associateWith { FocusRequester() } }
    val memory = rememberFocusMemory()
    val contentFocus = remember { FocusRequester() }

    BackHandler(enabled = !tabsFocused || tab != TopTab.Home) {
        val target = if (tabsFocused) TopTab.Home else tab
        runCatching { tabFocus.getValue(target).requestFocus() }
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.padding(start = Dimens.Gutter, end = Dimens.Gutter, top = Dimens.TopInset, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Movie Recs", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(32.dp))
            TabRow(
                selectedTabIndex = tab.ordinal,
                modifier = Modifier
                    .onFocusChanged { tabsFocused = it.hasFocus }
                    .focusRestorer(tabFocus.getValue(tab))
                    .focusGroup()
                    .focusFirstOnDown(contentFocus),
            ) {
                TopTab.entries.forEach { t ->
                    Tab(
                        selected = t == tab,
                        onFocus = { tab = t },
                        modifier = Modifier.focusRequester(tabFocus.getValue(t)),
                    ) {
                        Text(t.label, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp))
                    }
                }
            }
        }

        Box(Modifier.fillMaxSize().focusRequester(contentFocus)) {
            when (tab) {
                TopTab.Home -> {
                    val api = app().api
                    val vm = viewModel(key = "home") { BrowseViewModel(api, null) }
                    BrowseContent(vm, memory, prefix = "home", onOpen = onOpenMovie)
                }
                TopTab.Genres -> GenresScreen(memory, onOpenGenre)
                TopTab.Search -> SearchScreen(memory, onOpenMovie)
                TopTab.Watchlist -> WatchlistScreen(memory, onOpenMovie)
                TopTab.Account -> AboutScreen()
            }
        }
    }

    LaunchedEffect(Unit) {
        if (!initialFocusDone) {
            initialFocusDone = true
            withFrameNanos { }
            runCatching { tabFocus.getValue(tab).requestFocus() }
        }
    }
}

/**
 * Down from the tab bar jumps into the content and lands on the first item, not the nearest tile:
 * request focus on the content's [contentFocus] (attached to the content container), falling back to
 * normal movement if nothing down there is focusable yet (e.g. still loading).
 */
@Composable
fun Modifier.focusFirstOnDown(contentFocus: FocusRequester): Modifier {
    val focusManager = LocalFocusManager.current
    return onPreviewKeyEvent { e ->
        if (e.type != KeyEventType.KeyDown || e.key != Key.DirectionDown) return@onPreviewKeyEvent false
        if (!runCatching { contentFocus.requestFocus(); true }.getOrDefault(false)) {
            focusManager.moveFocus(FocusDirection.Down)
        }
        true
    }
}
