const crypto = modules.crypto;
const SECRET_KEY = 'PhTdBrZHcSaih5ESgtBMQuNYFfIpWp5U';

// Encryption function
function encrypt(text) {
    try {
        // Create a buffer from the secret key
        const key = crypto.scryptSync(SECRET_KEY, 'salt', 32);
        // Generate a random initialization vector
        const iv = crypto.randomBytes(16);
        // Create cipher using AES-256-CBC
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        // Encrypt the text
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        // Combine IV and encrypted data
        return iv.toString('base64') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

// Decryption function
function decrypt(encryptedText) {
    try {
        // Split the encrypted text into IV and data
        const textParts = encryptedText.split(':');
        const iv = Buffer.from(textParts.shift(), 'base64');
        const encryptedData = textParts.join(':');
        // Create a buffer from the secret key
        const key = crypto.scryptSync(SECRET_KEY, 'salt', 32);
        // Create decipher using AES-256-CBC
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        // Decrypt the data
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}


complete({
    encrypt,
    decrypt
});