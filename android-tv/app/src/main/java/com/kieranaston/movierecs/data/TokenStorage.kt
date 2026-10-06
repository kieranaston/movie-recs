package com.kieranaston.movierecs.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.content.edit
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** What the TV remembers between launches. */
@Serializable
data class StoredSession(val token: String, val email: String)

interface TokenStorage {
    fun read(): StoredSession?
    fun write(session: StoredSession)
    fun clear()
}

/**
 * Session storage encrypted with AES-256-GCM under a key that lives in the Android Keystore
 * (non-exportable; hardware-backed where the TV supports it). Only ciphertext touches disk,
 * and app backups are disabled, so the token never leaves the device.
 */
class KeystoreTokenStorage(context: Context) : TokenStorage {
    private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)

    override fun read(): StoredSession? {
        val blob = prefs.getString(KEY, null) ?: return null
        return try {
            val bytes = Base64.decode(blob, Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes, 0, IV_BYTES))
            json.decodeFromString(String(cipher.doFinal(bytes, IV_BYTES, bytes.size - IV_BYTES), Charsets.UTF_8))
        } catch (_: Exception) {
            clear() // unreadable (e.g. key invalidated): start signed out rather than crash
            null
        }
    }

    override fun write(session: StoredSession) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val sealed = cipher.iv + cipher.doFinal(json.encodeToString(StoredSession.serializer(), session).toByteArray(Charsets.UTF_8))
        prefs.edit { putString(KEY, Base64.encodeToString(sealed, Base64.NO_WRAP)) }
    }

    override fun clear() {
        prefs.edit { remove(KEY) }
    }

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE).run {
            init(
                KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build()
            )
            generateKey()
        }
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "movie-recs-session"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
        const val KEY = "session"
        val json = Json { ignoreUnknownKeys = true }
    }
}
