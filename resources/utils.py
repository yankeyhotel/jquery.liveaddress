import os.path as path


_MIME_TYPES = {
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.ico': 'image/ico',
    '.jpg' : 'image/jpeg',
    '.png' : 'image/png',
    '.bmp' : 'image/bmp',
    '.gif' : 'image/gif',
    '.svg' : 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.xsd': 'text/plain',
    '.ttf' : 'font/ttf',
    '.woff' : 'application/x-font-woff', #http://code.google.com/p/chromium/issues/detail?id=70283#c3
    '.eot' : 'application/vnd.ms-fontobject',
}


extension = lambda file: path.splitext(file)[1]


def get_mime_type(resource):
    return _MIME_TYPES.get(extension(resource), 'application/octet-stream')