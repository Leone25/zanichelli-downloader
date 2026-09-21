import crypto from "crypto";
import forge from "node-forge";

// pages are AES-CBC encrypted and base64 encoded, with the first 16 bytes of the
// resource key used as IV as well. Returns a Buffer because only svg pages are text,
// png and jpg ones are not
export function decryptFile(encryptionKey, encryptedData) {
	const key = Buffer.from(encryptionKey, "utf8").subarray(0, 16);
	const decipher = crypto.createDecipheriv("aes-128-cbc", key, key);
	return Buffer.concat([decipher.update(Buffer.from(encryptedData, "base64")), decipher.final()]);
}

// the resource key itself comes RSA encrypted, the reader hands out the private key
export function decryptEncryptionKey(rawPrivateKey, encryptedEncryptionKey) {
	const privateKey = [
		"-----BEGIN RSA PRIVATE KEY-----",
		...rawPrivateKey.match(/.{1,64}/g),
		"-----END RSA PRIVATE KEY-----",
	].join("\n");
	return forge.pki.privateKeyFromPem(privateKey).decrypt(forge.util.decode64(encryptedEncryptionKey));
}
