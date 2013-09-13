<?php
use Ratchet\WebSocket\WsServer;
use Ratchet\Server\IoServer;
use RtcServer\SignalingServer;

require dirname(__DIR__) . '/vendor/autoload.php';

$ws = new WsServer(new SignalingServer);
$ws->disableVersion(0);

IoServer::factory($ws, 8080)->run();