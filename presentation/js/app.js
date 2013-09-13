var isCaller = false,
    started = false,
    localStream,
    remoteStream,
    pc,
    signalQueue = [],
    offerRecieved = false;

var ws = new WebSocket('ws://'+window.location.hostname+':8080');

ws.onmessage = function(event) {
    var message = JSON.parse(event.data);
    
    switch(message.type) {
        case 'handshake':
            isCaller = message.isCaller;
            mayStartPc();
        break;
        default:
            if(isCaller || started) {
                processSignal(message);
            } else if(message.type == 'description') {
                    signalQueue.unshift(message);
                    offerRecieved = true;
                    mayStartPc();
            } else {
                signalQueue.push(message);
            }
        break;
    }
}

function requestMedia() {
    getUserMedia({audio: true, video: true}, 
        function (stream) {
            attachMediaStream(document.getElementById('local-video'), stream);
            localStream = stream;
            
            mayStartPc();
        },
        function() {}
    );
}

function mayStartPc() {
    if(!started && (isCaller || offerRecieved) && localStream) {
        started = true;
        
        pc = new RTCPeerConnection(
            {iceServers: [{url: 'stun:stun.l.google.com:19302'}]}, 
            {optional: [{DtlsSrtpKeyAgreement: true}]}
        );
        
        pc.onicecandidate = onIceCandidate;
        
        pc.onaddstream = function (event) {
            remoteStream = event.stream;
            attachMediaStream(document.getElementById('remote-video'), remoteStream);
        };
        
        
        pc.addStream(localStream);
        
        if(isCaller) {
            pc.createOffer(onDescription);
        
        } else {
            while (signalQueue.length > 0) processSignal(signalQueue.shift());
        }
    }
}

function processSignal(message) {
    switch(message.type) {
        case 'iceCandidate':
            var candidate = message.candidate;
            pc.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        break;
        case 'description':
            var description = message.description;
            pc.setRemoteDescription(
                new RTCSessionDescription(description)
            );
    
            if(description.type == 'offer') {
                pc.createAnswer(onDescription);
            }
        break;
    }
}

function onIceCandidate(event) {
    if(event.candidate == null) return;
    
    var message = {
        type: 'iceCandidate',
        candidate: event.candidate
    };
    
    ws.send(JSON.stringify(message));
}

function onDescription(description) {
    pc.setLocalDescription(description);
    
    var message = {
        type: 'description',
        description: description
    };
    
    ws.send(JSON.stringify(message));
}