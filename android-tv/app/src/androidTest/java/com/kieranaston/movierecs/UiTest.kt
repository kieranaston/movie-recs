package com.kieranaston.movierecs

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Column
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isFocusable
import androidx.compose.ui.test.onRoot
import androidx.compose.runtime.remember
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.tv.material3.Text
import com.kieranaston.movierecs.data.CastMember
import com.kieranaston.movierecs.data.Movie
import com.kieranaston.movierecs.data.MovieDetail
import com.kieranaston.movierecs.ui.components.MovieRow
import com.kieranaston.movierecs.ui.components.rememberFocusMemory
import com.kieranaston.movierecs.ui.details.DetailsContent
import com.kieranaston.movierecs.ui.focusFirstOnDown
import com.kieranaston.movierecs.ui.genres.GenreTile
import com.kieranaston.movierecs.ui.theme.MovieTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class UiTest {
    @get:Rule val compose = createComposeRule()

    private val detail = MovieDetail(tmdbId = 329865, title = "Arrival", year = 2016, runtime = 116)

    @OptIn(ExperimentalTestApi::class)
    @Test fun detailsWiresItsActionsToTheRemote() {
        var toggles = 0
        compose.setContent { MovieTheme { DetailsContent(detail, inWatchlist = false, onToggleWatchlist = { toggles++ }) } }
        val button = { label: String -> compose.onNode(hasText(label) and isFocusable()) }

        button("Add to Watchlist").assertIsFocused() // primary action takes focus for the remote
        compose.onRoot().performKeyInput { pressKey(Key.DirectionCenter) }
        assertEquals(1, toggles)
    }

    @Test fun detailsListsDirectorsAndCast() {
        val cast = listOf("Amy Adams", "Jeremy Renner").map { CastMember(it) }
        compose.setContent { MovieTheme { DetailsContent(detail.copy(directors = listOf("Denis Villeneuve"), cast = cast), inWatchlist = false, onToggleWatchlist = {}) } }
        compose.onNodeWithText("Directed by  Denis Villeneuve").assertExists()
        compose.onNodeWithText("Starring  Amy Adams, Jeremy Renner").assertExists()
    }

    /** Worst case on a TV-sized screen: a 1,000-character overview with a two-line title, tagline and full credits. */
    @Test fun longestOverviewFitsWithoutBeingCut() {
        val overview = "The quiet stranger returns home to settle an old family score. ".repeat(16)
        val worst = detail.copy(
            title = "The Assassination of Jesse James by the Coward Robert Ford",
            overview = overview,
            tagline = "Why are they here?",
            genres = listOf("Drama", "Western"),
            directors = listOf("Denis Villeneuve"),
            cast = List(6) { CastMember("Performer Number $it") },
        )
        compose.setContent {
            // The TV is 960 x 540 dp; CI's emulator is not, so pin the size and density.
            BoxWithConstraints {
                val density = Density(constraints.maxWidth / 960f, fontScale = 1f)
                CompositionLocalProvider(LocalDensity provides density) {
                    Box(Modifier.requiredSize(960.dp, 540.dp)) {
                        MovieTheme { DetailsContent(worst, inWatchlist = false, onToggleWatchlist = {}) }
                    }
                }
            }
        }
        val layouts = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText(overview).performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
        assertFalse(layouts.single().hasVisualOverflow)
    }

    @OptIn(ExperimentalTestApi::class)
    @Test fun dpadMovesAlongARow() {
        val movies = listOf(Movie(1, "One"), Movie(2, "Two"), Movie(3, "Three"))
        compose.setContent { MovieTheme { MovieRow("Row", movies, onOpen = {}, focusPrefix = "r", memory = rememberFocusMemory()) } }
        val card = { title: String -> compose.onNode(hasText(title) and isFocusable()) }
        card("One").requestFocus()
        card("One").assertIsFocused()
        compose.onRoot().performKeyInput { pressKey(Key.DirectionRight) }
        card("Two").assertIsFocused()
    }

    /** Up/Down lands on the poster directly above/below, not the one last focused in that row. */
    @OptIn(ExperimentalTestApi::class)
    @Test fun dpadUpDownStaysInTheColumn() {
        val top = (1..4).map { Movie(it, "Top $it") }
        val bottom = (11..14).map { Movie(it, "Bottom $it") }
        compose.setContent {
            MovieTheme {
                val memory = rememberFocusMemory()
                Column {
                    MovieRow("A", top, onOpen = {}, focusPrefix = "a", memory = memory)
                    MovieRow("B", bottom, onOpen = {}, focusPrefix = "b", memory = memory)
                }
            }
        }
        val card = { title: String -> compose.onNode(hasText(title) and isFocusable()) }
        card("Bottom 11").requestFocus()
        compose.onRoot().performKeyInput { pressKey(Key.DirectionUp) }
        card("Top 1").assertIsFocused()
        // One column over keeps both rows on screen even on CI's phone-width emulator.
        compose.onRoot().performKeyInput { pressKey(Key.DirectionRight) }
        card("Top 2").assertIsFocused()
        compose.onRoot().performKeyInput { pressKey(Key.DirectionDown) }
        card("Bottom 12").assertIsFocused() // a focusRestorer would send this back to Bottom 11
    }

    /** Down from the top tabs lands on the first item in the content, not the nearest one. */
    @OptIn(ExperimentalTestApi::class)
    @Test fun dpadDownFromTabsFocusesTheFirstItem() {
        compose.setContent {
            MovieTheme {
                val tab = remember { FocusRequester() }
                val content = remember { FocusRequester() }
                Column {
                    Box(Modifier.testTag("tab").focusRequester(tab).focusable().focusFirstOnDown(content)) {
                        Text("Tab")
                    }
                    Column(Modifier.focusRequester(content)) {
                        GenreTile("First", onClick = {})
                        GenreTile("Second", onClick = {})
                    }
                }
            }
        }
        compose.onNodeWithTag("tab").requestFocus()
        compose.onRoot().performKeyInput { pressKey(Key.DirectionDown) }
        compose.onNode(hasText("First") and isFocusable()).assertIsFocused()
    }
}
