var urlParser = require('url');

// NOTE: Url rewrite proxied requests (e.g. for iframes), so they will hit our server.
function urlRewriteProxyRequest (req, res, next) {
    var proxiedUrlPartRegExp = /^\/\S+?\/(https?:)/;

    if (proxiedUrlPartRegExp.test(req.url)) {
        // NOTE: Store the destination URL so we can send it back for testing purposes (see GET xhr-test route).
        req.originalUrl = req.url;

        var url = req.url.replace(proxiedUrlPartRegExp, '$1');

        // NOTE: Create host-relative URL.
        var parsedUrl = urlParser.parse(url);

        parsedUrl.host     = null;
        parsedUrl.hostname = null;
        parsedUrl.port     = null;
        parsedUrl.protocol = null;
        parsedUrl.slashes  = false;
        req.url            = urlParser.format(parsedUrl);
    }

    next();
}

module.exports = function (app) {
    app.use(urlRewriteProxyRequest);

    app.get('/xhr-large-response', function (req, res) {
        var data = new Array(1000);

        res.send(data);
    });

    app.all('/get-script/:script', function (req, res) {
        var script = req.params.script || '';

        res.send(script);
    });

    app.post('/service-msg/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.send(delay);
        }, delay);
    });

    app.get('/xhr-test/:delay', function (req, res) {
        var delay = req.params.delay || 0;

        setTimeout(function () {
            res.send(req.originalUrl || req.url);
        }, delay);
    });

    app.post('/xhr-origin-header-test/', function (req, res) {
        res.send(req.headers['x-hammerhead|xhr|origin']);
    });

    app.get('/xhr-222/', function (req, res) {
        res.statusCode = 222;
        res.send('true');
    });

    app.get('/redirect/', function (req, res) {
        res.statusCode = 302;
        res.setHeader('location', req.originalUrl.replace('redirect/' , 'xhr-large-response'));
        res.send();
    });

    app.get('/respond-500', function (req, res) {
        res.statusCode = 500;
        res.send('Server error');
    });

    app.post('/form-data', function (req, res) {
        var chunks = [];

        req.on('data', function (data) {
            chunks.push(data);
        });
        req.on('end', function () {
            res.end(chunks.join(''));
        });
    });

    app.post('/echo-request-body', function (req, res) {
        res.json(req.body);
    });

    app.all('/echo-request-headers', function (req, res) {
       res.json(req.headers);
    });
};
