package com.kieranaston.movierecs

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.test.assertTextEquals
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
import com.kieranaston.movierecs.ui.signin.SignInContent
import com.kieranaston.movierecs.ui.theme.MovieTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class UiTest {
    @get:Rule val compose = createComposeRule()

    private val detail = MovieDetail(tmdbId = 329865, title = "Arrival", year = 2016, runtime = 116, trailerKey = "7W1m5ER3I1Y")

    @Test fun signInShowsTheCodeAndQr() {
        compose.setContent {
            MovieTheme { SignInContent("WDJBMJHT", "https://movies.example/activate", "https://movies.example/activate?user_code=WDJBMJHT", afterDenial = false) }
        }
        compose.onNodeWithTag("user-code").assertTextEquals("WDJB-MJHT")
        compose.onNodeWithText("Or visit movies.example/activate and enter").assertExists()
        compose.onNodeWithContentDescription("QR code to sign in").assertExists()
    }

    @Test fun signInExplainsADenial() {
        compose.setContent { MovieTheme { SignInContent("WDJBMJHT", "https://x/activate", "https://x/activate?user_code=WDJBMJHT", afterDenial = true) } }
        compose.onNodeWithText("That request was denied. Here's a new code.").assertExists()
    }

    @OptIn(ExperimentalTestApi::class)
    @Test fun detailsWiresItsActionsToTheRemote() {
        var toggles = 0
        var trailer: String? = null
        compose.setContent { MovieTheme { DetailsContent(detail, inWatchlist = false, onToggleWatchlist = { toggles++ }, onPlayTrailer = { trailer = it }) } }
        val button = { label: String -> compose.onNode(hasText(label) and isFocusable()) }

        button("Trailer").assertIsFocused() // primary action takes focus for the remote
        compose.onRoot().performKeyInput { pressKey(Key.DirectionCenter) }
        assertEquals("7W1m5ER3I1Y", trailer)

        compose.onRoot().performKeyInput { pressKey(Key.DirectionRight) }
        button("Add to Watchlist").assertIsFocused()
        compose.onRoot().performKeyInput { pressKey(Key.DirectionCenter) }
        assertEquals(1, toggles)
    }

    @Test fun detailsListsDirectorsAndCast() {
        val cast = listOf("Amy Adams", "Jeremy Renner").map { CastMember(it) }
        compose.setContent { MovieTheme { DetailsContent(detail.copy(directors = listOf("Denis Villeneuve"), cast = cast), inWatchlist = false, onToggleWatchlist = {}, onPlayTrailer = {}) } }
        compose.onNodeWithText("Directed by  Denis Villeneuve").assertExists()
        compose.onNodeWithText("Starring  Amy Adams, Jeremy Renner").assertExists()
    }

    @Test fun detailsWithoutTrailerFocusesWatchlist() {
        compose.setContent { MovieTheme { DetailsContent(detail.copy(trailerKey = null), inWatchlist = true, onToggleWatchlist = {}, onPlayTrailer = {}) } }
        compose.onNodeWithText("Trailer").assertDoesNotExist()
        compose.onNode(hasText("In Watchlist") and isFocusable()).assertIsFocused()
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
