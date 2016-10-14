/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
// Toggle console logging output here.
var DEBUG = true;
if(!DEBUG){
    if(!window.console) window.console = {};
    var methods = ["log", "debug", "warn", "info"];
    for(var i=0;i<methods.length;i++){
        console[methods[i]] = function(){};
    }
}

function ResultHandler(
        resultId, spinnerId, successId, failureId, unknownId, resultMsgId, attemptAudioId
    )
{
    /* Handles the display/hiding of images related to results from syllableCheck. */
    var rh = this;
    rh.resultElem = $(resultId);
    rh.spinnerImg = $(spinnerId);    // Circular spinner
    rh.successImg = $(successId);    // Green checkmark
    rh.failureImg = $(failureId);    // Red X
    rh.unknownImg = $(unknownId);    // Blue Question Mark
    rh.resultMsgElem = $(resultMsgId);
    rh.attemptAudioElem = $(attemptAudioId);

    rh.clear = function() {
        rh.spinnerImg.hide();
        rh.successImg.hide();
        rh.failureImg.hide();
        rh.unknownImg.hide();
        rh.resultMsgElem.hide();
        rh.attemptAudioElem.hide();
    };

    rh.setAudioUrl = function(audioUrl) {
        rh.attemptAudioElem.attr('src', audioUrl);
        rh.attemptAudioElem[0].load();
    }
    
    rh.spinner = function() {
        rh.clear();
        rh.spinnerImg.show();
    };
    
    rh.success = function() {
        rh.clear();
        rh.successImg.show();
        rh.attemptAudioElem.show();
    };

    rh.failure = function(resultTone) {
        rh.clear();
        rh.failureImg.show();
        rh.resultMsgElem.html('Sounds like tone ' + resultTone);
        rh.resultMsgElem.show();
        rh.attemptAudioElem.show();
    };
    
    rh.unknown = function() {
        rh.clear();
        rh.unknownImg.show();
        rh.resultMsgElem.html("Sorry, can't tell which tone that's supposed to be");
        rh.resultMsgElem.show();
        rh.attemptAudioElem.show();
    };
    
    rh.hide = function() {
        rh.resultElem.hide();
    };

    rh.show = function() {
        rh.resultElem.show();
    }
    
    return rh;
}

function PromptHandler(syllableTextId, exampleAudioId) {
    var ph = this;
    ph.exampleAudioElem = $(exampleAudioId);
    ph.syllableTextElem = $(syllableTextId);

    ph.prompt = function(text, audioUrl) {
        ph.syllableTextElem.html(text);
        ph.exampleAudioElem.attr('src', audioUrl);
        ph.exampleAudioElem[0].load();
    };

    return this;
}

function ToneTutorServices(promptHandler, resultHandler) {
    var tts = this;
    tts.resultHandler = resultHandler;
    tts.promptHandler = promptHandler;

//    tts.host = 'http://test-api.mandarintt.com';
//    tts.host = 'http://192.168.1.100:9001';
    tts.host = 'https://www.mandarintt.com';
    tts.getSyllableUrl = tts.host + '/mobile-api/randomsyllable/';
    tts.getSyllableTimeout = 6000;
    tts.checkSyllableUrl = tts.host + '/mobile-api/tonecheck/';
    tts.checkSyllableTimeout = 40000;
    tts.currentSyllable = {
        'sound': null, 'tone': null, 'display': null, 'url': null, 'hanzi': null
    };
    tts.authUrl = tts.host + '/mobile-api/tokenauth/';
    tts.authTimeout = 6000;
    tts.authToken = '';

    tts.authenticate = function(success, error) {
        console.log('authenticate() entered');
        if (error === undefined) {
            console.log('No error callback provided, using default.');
            error = function(jqXHR, textStatus, errorThrown) {
                console.log('authenticate failed: ' + textStatus + ', ' + errorThrown);
            }
        }
        if (success === undefined) {
            console.log('No success callback provided, will only collect auth token.')
            success = function(){};
        }
        $.ajax({
            url: tts.authUrl,
            timeout: tts.authTimeout,
            type: 'POST',
            data: {username: 'joe', password: 'cool'},
            dataType: 'json',
            success: function(data, textStatus, jqXHR) {
                console.log('authenticate successful');
                tts.authToken = data.auth_token;
                success();
            },
            error: error,
        });
        console.log('leaving authenticate()');
    };

    this.ensureAuthenticated = function(afterAuthentication) {
        /* afterAuthentication is a callback which takes no arguments & is only called
         * if authentication has already been performed or after successful authentication.
         */
        if (tts.authToken == '') {
            // Looks like we need to authenticate.
            tts.authenticate(afterAuthentication);
        }
        else {
            // Looks like we're already authenticated, continue
            afterAuthentication();
        }
    }
    
    this._getRandomSyllable = function() {
        /* Collects a new syllable, updates the src attribute of element with id 'self.exampleAudioId'.
         * Fills in the innerHTML of elements with class self.syllableTextClass with the new syllable.
        */
        var f = function() {
            tts.resultHandler.hide();
            $.ajax({
                type: 'GET',
                url: tts.getSyllableUrl,
                timeout: tts.getSyllableTimeout,
                dataType: 'json',
                headers: {Authorization: 'Token ' + tts.authToken},

                success: function(data, textStatus, jqXHR) {
                    console.log('remote call in getRandomSyllable() successful');
                    tts.currentSyllable.tone = data.tone;
                    tts.currentSyllable.sound = data.sound;
                    tts.currentSyllable.display = data.display;
                    tts.currentSyllable.url = tts.host + data.url;
                    tts.currentSyllable.hanzi = data.hanzi;

                    // --- Generate the string to prompt the user with.
                    var hanziList = '';
                    for (var i = 0; i < tts.currentSyllable.hanzi.length; i++) {
                        hanziList = hanziList + tts.currentSyllable.hanzi[i][0];
                        if (i < tts.currentSyllable.hanzi.length - 1) {
                            hanziList = hanziList + ', '
                        }
                    }
                    var promptText = data.display;
                    promptText = promptText + ' (' + hanziList + ')';
                    tts.promptHandler.prompt(promptText, tts.currentSyllable.url);
                    return this;
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.log('remote call in getRandomSyllable() failed: ' + textStatus);
                    console.log(errorThrown);
                    return this;
                },
            });
        }
        return f;
    }

    this.getRandomSyllable = function() {
        // This is just a wrapper function to make sure the user is authenticated before
        // attempting to get a random syllable.
        tts.ensureAuthenticated(tts._getRandomSyllable());
    }

    this.checkSyllable = function(attemptData, attemptMd5) {
        /* attemptData is a Blob containing the user's attempt at pronunciation.
         * attemptMd5 is the MD5 Sum of attemptData.
         * Returns a function that takes no arguments but has access to attemptData & attemptMd5
         *  for use in a callback.
         */
        console.log('checkSyllable() entered with params: ' + attemptData.length + ' ' + attemptMd5);
        var f = function() {
            console.log('checkSyllableFile: entered');
            console.log('attempt md5: ' + attemptMd5);
            var data = new FormData();
            data.append('attempt', attemptData);
            data.append('attempt_md5', attemptMd5);
            data.append('extension', '3gpp');
            data.append('expected_sound', tts.currentSyllable.sound);
            data.append('expected_tone', tts.currentSyllable.tone);
            data.append('is_native', 'false');
    
            $.ajax({
                type: 'POST',
                url: tts.checkSyllableUrl,
                timeout: tts.checkSyllableTimeout,
                data: data,
                processData: false,
                contentType: false,
                headers: {Authorization: 'Token ' + this.authToken},
                dataType: 'json',
                success: function(data, textStatus, jqXHR) {
                    console.log('checkSyllable ajax success:');
                    console.log(data);
                    var attemptUrl = data.attempt_url
                    tts.resultHandler.setAudioUrl(attemptUrl)
                    if (data.tone == null) {
                        tts.resultHandler.unknown();
                        tts.resultHandler.show();
                    }
                    else if (data.tone == tts.currentSyllable.tone) {
                        tts.resultHandler.success();
                        tts.resultHandler.show();
                    }
                    else {
                        tts.resultHandler.failure(data.tone);
                        tts.resultHandler.show();
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.log('checkSyllable ajax failure: ');
                    console.log('textStatus, errorThrown: ' + textStatus + ', ' + errorThrown);
                    tts.resultHandler.hide();
                }
            });
            console.log('checkSyllable: leaving');
        }
        return f;
    }
    
    return tts;
};

var app = {
    // Application Constructor
    initialize: function(toneTutorServices) {
        this.toneTutorServices = toneTutorServices;
        this.toneTutorServices.authenticate(this.toneTutorServices.getRandomSyllable());
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        document.addEventListener('click', this.onClick, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
    },
    onClick: function() {
        $('#animation').hide();
        $('#splashtext').hide();
        $('#controls').show();
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    },
    convertMediaFileToBlob: function(mf, success, failure) {
        // mf is a MediaFile instance, success(blob, attemptMd5) is called after conversion.
        // Actually converts to an ArrayBuffer rather than a Blob.
        var app = this;
        if (failure == undefined) {
            failure = function() {console.log('convertMediaFileToBlob failed')};
        }
        audio_filepath = mf.fullPath;

        function gotFile(fileEntry) {
            fileEntry.file(function(file) {
                var reader = new FileReader();

                reader.onloadend = function(e) {
                    var attemptMd5 = SparkMD5.ArrayBuffer.hash(this.result);
                    var blob = new Blob([this.result]);
                    app.toneTutorServices.ensureAuthenticated(success(blob, attemptMd5));
                }

                reader.readAsArrayBuffer(file);
            });
        }
        function failFile() {
            console.log('resolveLocalFileSystemURL failed');
            failure();
        }

        window.resolveLocalFileSystemURL(
            mf.fullPath, gotFile, failFile
        );        
    },
    recordAttempt: function() {
        var app = this;
        var options = { limit: 1, duration: 2 };
        app.toneTutorServices.resultHandler.spinner();
        app.toneTutorServices.resultHandler.show();
        navigator.device.capture.captureAudio(
            function(mediaFiles){
                console.log('captured');
                var mf = mediaFiles[0];
                console.log(mf);
                app.convertMediaFileToBlob(mf, app.toneTutorServices.checkSyllable);
            },
            function(error){
                console.log('capture failed: ' + error);
                app.toneTutorServices.resultHandler.hide();
            },
            options
        );
    },
};
