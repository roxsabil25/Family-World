const path = require('path');
const { PassThrough } = require('stream');
const { randomUUID } = require('crypto');
const { google } = require('googleapis');

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1W87p5t9JoEU_IHAyoTni1UaEWvNxZDjC';
const CREDENTIALS_PATH = path.join(__dirname, '..', 'google-credentials.json');
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const folderCache = new Map();

const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
};

const log = (level, message, details) => {
    const color = colors[level] || '';
    const logger = level === 'error' ? console.error : console.log;
    logger(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`, details || '');
};

let driveClient;

const getDrive = () => {
    if (!driveClient) {
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/drive']
        });
        driveClient = google.drive({ version: 'v3', auth });
    }
    return driveClient;
};

const getSubfolderId = async (name) => {
    if (folderCache.has(name)) {
        return folderCache.get(name);
    }

    const drive = getDrive();
    const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const existing = await drive.files.list({
        q: `name = '${escapedName}' and mimeType = '${FOLDER_MIME_TYPE}' and '${ROOT_FOLDER_ID}' in parents and trashed = false`,
        fields: 'files(id,name)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });

    if (existing.data.files?.length) {
        const folderId = existing.data.files[0].id;
        folderCache.set(name, folderId);
        return folderId;
    }

    const created = await drive.files.create({
        requestBody: {
            name,
            mimeType: FOLDER_MIME_TYPE,
            parents: [ROOT_FOLDER_ID]
        },
        fields: 'id',
        supportsAllDrives: true
    });

    if (!created.data.id) {
        throw new Error(`Google Drive did not return an ID for the ${name} folder.`);
    }

    folderCache.set(name, created.data.id);
    log('success', `Created Google Drive folder: ${name}`, created.data.id);
    return created.data.id;
};

const resolveParentFolder = async (category) => {
    if (category === 'video') {
        return ROOT_FOLDER_ID;
    }
    if (category === 'ad') {
        return getSubfolderId('Ads');
    }
    if (category === 'screenshot') {
        return getSubfolderId('Payment Screenshots');
    }
    throw new Error(`Unsupported Google Drive upload category: ${category}`);
};

const safeFileName = (originalName) => {
    const baseName = path.basename(originalName || 'upload')
        .replace(/[^\w.-]+/g, '_')
        .replace(/^\.*/, '')
        .slice(-180);
    return baseName || 'upload';
};

const deleteDriveFile = async (fileId) => {
    if (!fileId) {
        return;
    }

    try {
        await getDrive().files.delete({
            fileId,
            supportsAllDrives: true
        });
        log('success', 'Deleted Google Drive file:', fileId);
    } catch (error) {
        log('error', `Failed to delete Google Drive file ${fileId}:`, error);
        throw error;
    }
};

const uploadBuffer = async ({ buffer, originalName, mimeType, category }) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error('Cannot upload an empty file buffer to Google Drive.');
    }

    let createdFileId;
    try {
        const drive = getDrive();
        const parentFolderId = await resolveParentFolder(category);
        const prefix = category === 'screenshot' ? 'payment' : category;
        const fileName = `${prefix}-${Date.now()}-${randomUUID()}-${safeFileName(originalName)}`;
        const mediaStream = new PassThrough();

        log('info', `Streaming ${category} file to Google Drive (${buffer.length} bytes):`, fileName);
        const uploadResponsePromise = drive.files.create({
            requestBody: {
                name: fileName,
                mimeType,
                parents: [parentFolderId]
            },
            media: {
                mimeType,
                body: mediaStream
            },
            fields: 'id,name,webViewLink,webContentLink',
            supportsAllDrives: true
        });
        mediaStream.end(buffer);

        const uploadResponse = await uploadResponsePromise;
        createdFileId = uploadResponse.data.id;
        if (!createdFileId) {
            throw new Error('Google Drive upload completed without returning a file ID.');
        }

        await drive.permissions.create({
            fileId: createdFileId,
            requestBody: {
                type: 'anyone',
                role: 'reader'
            },
            fields: 'id',
            supportsAllDrives: true
        });

        const webViewLink = uploadResponse.data.webViewLink
            || `https://drive.google.com/file/d/${createdFileId}/view`;
        const playbackUrl = uploadResponse.data.webContentLink
            || `https://drive.google.com/uc?export=download&id=${createdFileId}`;

        log('success', `Uploaded ${category} file to Google Drive:`, createdFileId);
        return {
            driveFileId: createdFileId,
            webViewLink,
            playbackUrl,
            fileName
        };
    } catch (error) {
        log('error', `Google Drive ${category} upload failed:`, error);
        if (createdFileId) {
            try {
                await deleteDriveFile(createdFileId);
            } catch (cleanupError) {
                log('error', `Could not clean up incomplete Drive upload ${createdFileId}:`, cleanupError);
            }
        }
        throw error;
    }
};

module.exports = {
    uploadBuffer,
    deleteDriveFile
};
