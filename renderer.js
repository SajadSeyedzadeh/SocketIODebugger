
const os = require('os');
const app = require('electron').remote.app;
var basepath = app.getAppPath();
var shell = require('electron').shell;
var storagePath = basepath + `//` + 'storage//';
var Datastore = require('nedb'),
    db = new Datastore({
        filename: storagePath + 'db.nedb',
        autoload: true
    });
module.exports = {
    storeData: storeData = (doc, callback) => {
        db.insert(doc, function (err, newDoc) {
            if (err) throw err;
            callback();
        });
    },
    getData: getData = (id, callback) => {
        // The same rules apply when you want to only find one document
        db.findOne({
            _id: id
        }, function (err, doc) {
            callback(err, doc);
        });
    },
    getAllData: getAllData = (callback) => {
        db.find({}, function (err, docs) {
            callback(err, docs);
        });
    },
    removeAllDocs: removeAllDocs = (callback) => {
        db.remove({}, {
            multi: true
        }, function (err, numRemoved) {
            callback(err, numRemoved);
        });
    },
    shell : shell
}