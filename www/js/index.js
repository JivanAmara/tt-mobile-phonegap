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

function ResultHandler(resultId, spinnerId, successId, failureId, unknownId, soundsLikeId) {
    /* Handles the display/hiding of images related to results from syllableCheck. */
    var rih = this;
    rih.resultElem = $(resultId);
    rih.spinnerImg = $(spinnerId);    // Circular spinner
    rih.successImg = $(successId);    // Green checkmark
    rih.failureImg = $(failureId);    // Red X
    rih.unknownImg = $(unknownId);    // Blue Question Mark
    rih.soundsLikeElem = $(soundsLikeId);

    rih.clear = function() {
        rih.spinnerImg.hide();
        rih.successImg.hide();
        rih.failureImg.hide();
        rih.unknownImg.hide();
        rih.soundsLikeElem.hide();
    };

    rih.spinner = function() {
        rih.clear();
        rih.spinnerImg.show();
    };
    
    rih.success = function() {
        rih.clear();
        rih.successImg.show();
    };

    rih.failure = function() {
        rih.clear();
        rih.failureImg.show();
        rih.soundsLikeElem.show();
    };
    
    rih.unknown = function() {
        rih.clear();
        rih.unkownImg.show();
    };
    
    rih.hide = function() {
        rih.resultElem.hide();
    };

    rih.show = function() {
        rih.resultElem.show();
    }
    
    return rih;
}

function ToneTutorServices(exampleAudioId, syllableTextClass, resultToneClass, resultHandler) {
    var tts = this;
    this.exampleAudioId = exampleAudioId;
    this.syllableTextClass = syllableTextClass;
    this.resultToneClass = resultToneClass;
    this.resultHandler = resultHandler
    
    this.host = 'http://192.168.1.100:8001';
    this.getSyllableUrl = this.host + '/api/randomsyllable/';
    this.checkSyllableUrl = this.host + '/api/tonecheck/';
    this.currentSyllable = {
        'sound': null, 'tone': null, 'display': null, 'url': null, 'hanzi': null
    };
    this.authUrl = this.host + '/api/tokenauth/';
    this.authTimeout = 3000;
    this.authToken = '';

    this.authenticate = function(success) {
        console.log('authenticate() entered');
        $.ajax({
            url: tts.authUrl,
            timeout: tts.authTimeout,
            type: 'POST',
            data: {username: 'joe', password: 'cool'},
            dataType: 'json',
            success: function(data, textStatus, jqXHR) {
                console.log('authenticate successful');
                tts.authToken = data.auth_token;
                if (success != undefined) {
                    success();
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log('authenticate failed: ' + textStatus + ', ' + errorThrown);
            }
        })
    };

    this.getRandomSyllable = function() {
        /* Collects a new syllable, updates the src attribute of element with id 'self.exampleAudioId'.
         * Fills in the innerHTML of elements with class self.syllableTextClass with the new syllable.
        */
        tts.resultHandler.hide();
        $.ajax({
            type: 'GET',
            url: tts.getSyllableUrl,
            dataType: 'json',
            headers: {Authorization: 'Token ' + tts.authToken},

            success: function(data, textStatus, jqXHR) {
                console.log('remote call in getRandomSyllable() successful');
                tts.currentSyllable.tone = data.tone;
                tts.currentSyllable.sound = data.sound;
                tts.currentSyllable.display = data.display;
                tts.currentSyllable.url = tts.host + data.url;
                tts.currentSyllable.hanzi = data.hanzi;

                example_audio = document.getElementById(self.exampleAudioId);
                example_audio.src = tts.currentSyllable.url;
                example_audio.load();

                var displayText = data.display;
                var hanziList = '';
                for (var i = 0; i < tts.currentSyllable.hanzi.length; i++) {
                    hanziList = hanziList + tts.currentSyllable.hanzi[i][0];
                    if (i < tts.currentSyllable.hanzi.length - 1) {
                        hanziList = hanziList + ', '
                    }
                }
                displayText = displayText + ' (' + hanziList + ')';
                syllableTextElems = document.getElementsByClassName(tts.syllableTextClass);
                for (var i = 0; i < syllableTextElems.length; i++) {
                    syllableTextElems[i].innerHTML = displayText;
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log('remote call in getRandomSyllable() failed: ' + textStatus);
                console.log(errorThrown);
            },
        });
    };

    this.checkSyllable = function(attemptData) {
        /* attemptData is a Blob containing the user's attempt at pronunciation.
         * 
         */
        console.log('checkSyllableFile: entered');
        var attempt_md5_hex = SparkMD5.ArrayBuffer.hash(attemptData);
        console.log('attempt md5: ' + attempt_md5_hex);
        var data = new FormData();
        data.append('attempt', attemptData);
        data.append('attempt_md5', attempt_md5_hex);
        data.append('extension', '3gpp');
        data.append('expected_sound', tts.currentSyllable.sound);
        data.append('expected_tone', tts.currentSyllable.tone);
        data.append('is_native', 'false');

        $.ajax({
            type: 'POST',
            url: tts.checkSyllableUrl,
            data: data,
            processData: false,
            contentType: false,
            headers: {Authorization: 'Token ' + this.authToken},
            dataType: 'json',
            success: function(data, textStatus, jqXHR) {
                console.log('checkSyllable ajax success:');
                console.log(data);
                resultToneElems = document.getElementsByClassName(tts.resultToneClass);
                for (var i = 0; i < resultToneElems.length; i++) {
                    resultToneElems[i].innerHTML = data.tone;
                }

                if (data.tone == tts.currentSyllable.tone) {
                    tts.resultHandler.success();
                    tts.resultHandler.show();
                }
                else {
                    tts.resultHandler.failure();
                    tts.resultHandler.show();
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log('checkSyllable ajax failure: ');
                console.log('textStatus, errorThrown: ' + textStatus + ', ' + errorThrown);
                tts.resultHandler.hide();
            }
        });
        console.log('checkSyllableFile: leaving')
    }
    return tts;
};

var app = {
    // Application Constructor
    initialize: function(toneTutorServices) {
        this.toneTutorServices = toneTutorServices;
        this.toneTutorServices.authenticate(this.toneTutorServices.getRandomSyllable);
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
        if (failure == undefined) {
            failure = function() {console.log('convertMediaFileToBlob failed')};
        }
        audio_filepath = mf.fullPath;

        function gotFile(fileEntry) {
            fileEntry.file(function(file) {
                var reader = new FileReader();

                reader.onloadend = function(e) {
                    var blob = new Blob([this.result]);
                    success(blob);
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
