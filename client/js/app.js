window.addEventListener('load', function(event){
    if(browserCapable == false) {
        document.getElementById('body').className += 'no-supported';
    } else {
        initializeWebRTC();
    }
});

var isCaller = false,
    started = false,
    localStream,
    pc,
    signalQueue = [],
    offerRecieved = false,
    ws;


function initializeWebRTC() {
    
    ws = new WebSocket('ws://'+window.location.hostname+':8080');

    requestMedia();

    ws.onmessage = function(e) {
        var message = JSON.parse(e.data);

        switch(message.type) {
            case 'handshake':
                isCaller = message.isCaller;
                mayStartPc();
            break;
            default:
                if(isCaller || started) {
                    processSignal(message);
                } else if(message.type == 'description') {
                        //The session description must be added to the peer connection before the ice canditdate is added
                        signalQueue.unshift(message);
                        offerRecieved = true;
                        mayStartPc();
                } else {
                    signalQueue.push(message);
                }
            break;
        }
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
    
        pc.onaddstream = gotRemoteStream;
    
        pc.addStream(localStream);
    
        if(isCaller) {
            pc.createOffer(onDescription);
        } else {
            while (signalQueue.length > 0) processSignal(signalQueue.shift());
        }
    }
}

function gotRemoteStream(event) {
    attachMediaStream(document.getElementById('remote-video'), event.stream);
}

function processSignal(message) {
    switch(message.type) {
        case 'iceCandidate':
            processRemoteCandidate(message.candidate);
        break;
        case 'description':
            processRemoteDescription(message.description);
        break;
    }
}

function processRemoteCandidate(candidate) {
    pc.addIceCandidate(
        new RTCIceCandidate(candidate)
    );
}

function processRemoteDescription(description) {
    pc.setRemoteDescription(
        new RTCSessionDescription(description)
    );

    if(description.type == 'offer') {
        pc.createAnswer(onDescription);
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