package com.kieranaston.movierecs

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.kieranaston.movierecs.data.KeystoreTokenStorage
import com.kieranaston.movierecs.data.StoredSession
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/** Runs on a device/emulator: exercises the real Android Keystore. */
@RunWith(AndroidJUnit4::class)
class KeystoreTokenStorageTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val storage = KeystoreTokenStorage(context)

    @After fun clear() = storage.clear()

    @Test fun roundTripsTheSession() {
        storage.write(StoredSession("secret-token-123", "alice@example.com"))
        assertEquals(StoredSession("secret-token-123", "alice@example.com"), KeystoreTokenStorage(context).read())
    }

    @Test fun storesOnlyCiphertext() {
        storage.write(StoredSession("secret-token-123", "alice@example.com"))
        val onDisk = context.getSharedPreferences("session", Context.MODE_PRIVATE).all.values.joinToString()
        assertFalse(onDisk.contains("secret-token-123"))
        assertFalse(onDisk.contains("alice@example.com"))
    }

    @Test fun clearForgetsTheSession() {
        storage.write(StoredSession("t", "a@b.c"))
        storage.clear()
        assertNull(storage.read())
    }

    @Test fun corruptDataReadsAsSignedOut() {
        context.getSharedPreferences("session", Context.MODE_PRIVATE).edit().putString("session", "not-valid").commit()
        assertNull(storage.read())
    }
}
