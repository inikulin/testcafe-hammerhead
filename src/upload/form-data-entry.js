import * as bufferUtils from '../utils/buffer';

// Const
const INPUT_NAME_RE = /;\s*name="([^"]*)"/i;
const FILE_NAME_RE  = /;\s*filename="([^"]*)"/i;
const HEADER_RE     = /^(.+?):\s*(.*)$/;


// FormDataEntry
export default class FormDataEntry {
    constructor () {
        this.body     = [];
        this.headers  = {};
        this.name     = null;
        this.fileName = null;
    }

    _parseContentDisposition (contentDisposition) {
        var inputNameMatch = contentDisposition.match(INPUT_NAME_RE);
        var fileNameMatch  = contentDisposition.match(FILE_NAME_RE);

        this.name     = inputNameMatch && inputNameMatch[1];
        this.fileName = fileNameMatch && fileNameMatch[1];
    }

    _setContentDisposition (name, fileName) {
        this.name     = name;
        this.fileName = fileName;

        this.headers['Content-Disposition'] = `form-data; name="${name}"; filename="${fileName}"`;
    }

    // API
    addFileInfo (fileInfo, idx) {
        var file = fileInfo.files[idx];

        this._setContentDisposition(fileInfo.name, file.name);

        this.body                    = [new Buffer(file.data, 'base64')];
        this.headers['Content-Type'] = file.type;
    }

    setHeader (header, newValue) {
        var headerMatch = header.match(HEADER_RE);
        var name        = headerMatch[1];
        var value       = newValue || headerMatch [2];

        this.headers[name] = value;

        if (name === 'Content-Disposition')
            this._parseContentDisposition(value);
    }

    toBuffer () {
        var chunks = [];

        Object.keys(this.headers).forEach(name => {
            var value = this.headers[name];

            chunks.push(new Buffer(`${name}: ${value}`));
            chunks.push(bufferUtils.CRLF);
        });

        chunks.push(bufferUtils.CRLF);
        chunks     = chunks.concat(this.body);

        return Buffer.concat(chunks);
    }
}
