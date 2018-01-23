var socket = null;
var socketRetry = 0;
var event_params = {};
var logs = [];
var responses = [];
$(function () {
    var handler = function (event) {
        showSnackbarButton.style.backgroundColor = '';
    };
    $('#btn-connect-socket').on('click', function () {
        if (socket) socket.disconnect();
        var address = $('#txt-socket-url').val();
        toastr.info(`Connecting to '${address}'`, 'Connection');
        initializeConnection(address, function () {
            socketUIUpdate(1);
            addLog('Connection', `Initializing connection to ${address}`);
        }, function () {
            socketUIUpdate(1);
            addLog('Connection', `Connected to ${address}`);
        }, function () {
            socketUIUpdate(0);
            addLog('Connection', `Disconnected from ${address}`);
        }, function () {
            socketUIUpdate(0);
            addLog('Connection', `Failed to establish connection to ${address}`);
        });
    });

    function socketUIUpdate(status) {
        switch (status) {
            case 0:
                $('#btn-disconnect-socket').attr('disabled', 'disabled');
                $('#btn-connect-socket').removeAttr('disabled');
                $('#txt-socket-url').attr('readonly', false);
                $('#btn-send-message').attr('disabled', 'disabled');
                break;
            case 1:
                $('#btn-connect-socket').attr('disabled', 'disabled');
                $('#btn-disconnect-socket').removeAttr('disabled');
                $('#txt-socket-url').attr('readonly', true);
                $('#btn-send-message').removeAttr('disabled');
                break;
        }
    }

    $('#btn-disconnect-socket').on('click', function () {
        if (!socket) {
            toastr.warning(`Please Connect to server first.\nPlease connect to server first!`);
            return false;
        };
        socket.disconnect();
        socketUIUpdate(0);
    });

    $('#btn-send-message').on('click', function () {
        if (!socket.connected) {
            toastr.warning(`Please Connect to server first.\nPlease connect to server first!`);
            return false;
        };
        var eventName = $('#txt-event-name').val();
        addLog('<span class="null">Events</span>', `Message sent to '${eventName}'`);
        toastr.success(`Message sent to '${eventName}'`, 'Events');
        (Object.keys(event_params).length > 0) ? socket.emit(eventName, event_params): socket.emit(eventName);
        addSocketEventListener(eventName, function (data) {
            var result = data;
            if (typeof data == 'object') {
                result = syntaxHighlight(data);
            }
            toastr.success(`'${eventName}' responded with data`, 'Events');
            addLog('<span class="null">Events</span>', `'${eventName}' responded with data`);
            addResponse(eventName, result);
            var inst = $('[data-remodal-id=event_reponse_preview_modal]').remodal();
            inst.open();
            window.scrollTo(0, document.body.scrollHeight);
            socket.removeAllListeners(eventName);
        });
    });

    function addSocketEventListener(eventName, callback) {
        socket.on(eventName, function (data) {
            callback(data);
        })
    }
    $('#btn-add-item-to-param').on('click', function () {
        var paramKey = $('#txt-param-key').val();
        var paramValue = $('#txt-param-value').val();

        var duplicateKey = checkKeyExist(paramKey);
        if (duplicateKey) toastr.warning(`Duplicate key '${duplicateKey}', Will override value.`);
        event_params[paramKey] = paramValue;
        $('#txt-param-key').val('');
        $('#txt-param-value').val('');
        $('#txt-param-key').focus();
        updateParamUI();
    });

    $('#btn-clear-all-params').on('click', function () {
        event_params = {};
        updateParamUI();
    });
    $('#btn-clear-all-response').on('click', function () {
        responses = [];
        updateResponseUI();
    });

    $('#btn-save-all-params').on('click', function () {
        if (!socket) {
            toastr.warning(`Please Connect to server first.\nPlease connect to server first!`);
            return false;
        };
        if (Object.keys(event_params).length <= 0) {
            toastr.warning(`No params to store.`, `Params Storage`);
            return false;
        }
        var date = new Date().toLocaleString();
        var eventName = $('#txt-event-name-store').val(),
            connectionName = $('#txt-socket-url').val();
        var dataToStore = {
            name: (eventName.length > 0) ? eventName + '_' + date : connectionName + '_' + date,
            date: date,
            event_params: event_params
        };

        renderer.storeData(dataToStore, function () {
            toastr.success(`${Object.keys(event_params).length} Parameters were saved in storage successfully.`, 'Params Storage');
        });
    });
    $('#btn-clear-db').on('click', function () {
        if (confirm('Are you sure you want to clear entire database?')) {
            renderer.removeAllDocs(function () {
                toastr.success(`Database cleared successfully.`, 'Params Storage');
            });
        }
    })
    $('#btn-clear-all-log').on('click',function() {
        if (confirm('Are you sure you want to clear all logs?')) {
            logs = {};
            toastr.success(`Logs cleared.`, 'Logs');
            updateLogUI();
        }
    })
    $('#btn-import-from-json-doc').on('click', function () {
        var data = null;
        try {
            var content = $('#ta-import-from-json-doc').val();
            data = JSON.parse(content);
        } catch (e) {
            addLog('<span class="null">JSON Parser</span>', `Failed to parse JSON with exception : ${e}'`);
            toastr.error(`Failed to parse JSON data!'`, 'JSON Parser')
        }
        if (data) {
            event_params = data;
            toastr.success(`JSON Parser parsed data successfully.`, 'JSON Parser');
            updateParamUI();
        }
    })
    $('#btn-import-all-params').on('click', function () {
        var importList = $('#lst-params-import');
        importList.empty();
        renderer.getAllData(function (error, data) {
            if (data.length <= 0) {
                var ui_element = `<div class="mdl-list__item"> <span class="mdl-list__item-primary-content"> <i class="material-icons mdl-list__item-avatar">cancel</i> <span>No Data found</span> </span> <a class="mdl-list__item-secondary-action" href="#params-modal"> <i class="material-icons">add</i> </a> </div>`;
                importList.append(ui_element);
                return false;
            }
            data.forEach(function (element, i) {
                var ui_element = `<div class="mdl-list__item"> <span class="mdl-list__item-primary-content"> <i class="material-icons mdl-list__item-avatar">cached</i> <span>${element.name}</span> </span> <a class="mdl-list__item-secondary-action" onclick="importItemFromDatabase('${element._id}')" href="#params-modal"> <i class="material-icons">add</i> </a> </div>`;
                importList.append(ui_element);
            })
        });
    })


    function checkKeyExist(key) {
        var result = null;
        var keys = Object.keys(event_params);
        keys.forEach(function (element, i) {
            if (element === key) result = element;
        })
        return result;
    }


    function initializeConnection(address, initialize, connection, disconnect, error) {
        socket = io(address);
        initialize();
        socket.on('connect', function () {
            toastr.success(`Connection to '${address}' was successfull!`, 'Connection');
            connection();
        })
        socket.on('connect_error', function (data) {
            if (socketRetry >= setting.app.socket.maxAttemptToConnect) {
                socketRetry = 0;
                socket.disconnect();
                toastr.remove();
                toastr.warning(`Disconnected from '${address}' due to Max attempt of connection. [${setting.app.socket.maxAttemptToConnect}]`, 'Connection');
                error();
            }
            socketRetry++;
            toastr.error(`Failed to connect to '${address} [${socketRetry}]'`, 'Connection')
        });
        socket.on('disconnect', function () {
            toastr.warning(`Disconnected from '${address}'!`, 'Connection')
            disconnect();
        });
    }
})

function addResponse(eventName, response) {
    var date = new Date().toLocaleString();
    responses.push({
        eventName: eventName,
        response: response,
        date: date
    });
    updateResponseUI();
}

function addLog(name, description) {
    var date = new Date().toLocaleString();
    logs.push({
        name: name,
        description: description,
        date: date
    });
    if (Object.keys(logs).length > 0) updateLogUI();
}

function updateResponseUI() {
    var responseList = $('#event-response-preview-content');
    responseList.empty();
    var keys = Object.keys(responses);
    for (var i = 0; i < keys.length; i++) {
        const element = responses[keys[i]];
        var ui_element = `<div><h5>${element.eventName}</h5><h6>${element.date}</h6><pre>${element.response}</pre></div>`;
        responseList.append(ui_element);
    }
}

function updateParamUI() {
    var paramList = $('#lst-param');
    paramList.empty();
    var keys = Object.keys(event_params);
    for (var i = 0; i < keys.length; i++) {
        const element = event_params[keys[i]];
        const ui_element = `<li class="mdl-list__item"> <span class="mdl-list__item-primary-content"> <button id='btn-remove-param-${i}' onclick='removeParamFromList("${keys[i]}")' class="mdl-button mdl-js-button mdl-js-ripple-effect mdl-button--accent"> X </button> ${keys[i]}  - ${element} </span> </li>`;
        paramList.append(ui_element);
    }
}
function updateLogUI() {
    var logList = $('#lst-logs-list');
    logList.empty();
    var keys = Object.keys(logs);
    if (keys.length == 0) {
        logList.append('<li> <span class="text-center">No log to view here...</span> </li>');
        return false;
    }
    for (var i = 0; i < keys.length; i++) {
        const element = logs[keys[i]];
        var ui_element = `<li class="mdl-list__item"> <i class="material-icons">code</i> <span class="mdl-list__item-primary-content"> ${element.date}  :  <span class='key'>${element.name}</span> - <span class='string'>${element.description}</span> </span></li>`;
        logList.append(ui_element);
    }


}


function importItemFromDatabase(_id) {
    renderer.getData(_id, function (err, data) {
        event_params = data.event_params;
        updateParamUI();
    });
}

function removeParamFromList(key) {
    delete event_params[key];
    updateParamUI();
}

function syntaxHighlight(json) {
    if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    renderer.shell.openExternal(this.href);
});