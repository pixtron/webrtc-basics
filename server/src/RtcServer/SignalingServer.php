<?php
namespace RtcServer;
use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

class SignalingServer implements MessageComponentInterface {
    protected $soloUsers;
    protected $pairedClients = array();

    public function __construct() {
        $this->soloUsers = new \SplObjectStorage;
    }
    
    public function onOpen(ConnectionInterface $conn) {
         $partner = $this->findPartner($conn);

         $msg = array(
             'type' => 'handshake',
             'isCaller' => $partner !== NULL
         );
         
         $conn->send(json_encode($msg));
         
         echo "Client connected with resource ID {$conn->resourceId}\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $peer = $this->findPairedPeer($from);
        
        if($peer instanceof ConnectionInterface) {
            $peer->send($msg);
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->peerDisconnected($conn);

        echo "Connection {$conn->resourceId} has disconnected\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "An error has occurred: {$e->getMessage()}\n";
        
        $conn->close();
    }
    
    protected function findPartner(ConnectionInterface $me) {
        $this->soloUsers->rewind();
        $partner = $this->soloUsers->current();
        
        if($partner) {
            $this->soloUsers->detach($partner);

            $this->pairedClients[$partner->resourceId] = $me;
            $this->pairedClients[$me->resourceId] = $partner;
        } else {
            $this->soloUsers->attach($me);
        }
        
        return $partner;
    }
    
    protected function findPairedPeer($conn) {
        $peer = array_key_exists($conn->resourceId, $this->pairedClients) ? $this->pairedClients[$conn->resourceId] : NULL;
        
        return $peer;
    }
    
    protected function peerDisconnected($conn) {
        if($this->soloUsers->contains($conn)) {
            $this->soloUsers->detach($conn);
        }
        
        if(array_key_exists($conn->resourceId, $this->pairedClients)){
            $partner = $this->pairedClients[$conn->resourceId];
            unset($this->pairedClients[$conn->resourceId]);
            
            if(array_key_exists($partner->resourceId, $this->pairedClients)) {
                unset($this->pairedClients[$partner->resourceId]);
            }
        }
    }
}