import React, {useState, useEffect, useRef} from "react";
import {useSelector} from "react-redux";
import {RootState} from "../store/store";
import {
  Input,
  Button,
  Spacer,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  addToast,
} from "@heroui/react";
import {Settings} from "lucide-react";
import {Progress} from "@heroui/progress";
import {realtimeDB} from "../libs/firebase.tsx";
import {ref, set, onValue, remove} from "firebase/database";
import {v4 as uuidv4} from "uuid";

const CHUNK_SIZE = 16 * 1024;

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const checkState = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", checkState);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", checkState);
  });
}

const readFileSlice = (file: File, start: number): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) resolve(e.target.result as ArrayBuffer);
      else reject("Failed to read file slice");
    };
    reader.onerror = reject;
    const slice = file.slice(start, start + CHUNK_SIZE);
    reader.readAsArrayBuffer(slice);
  });
};

const sendChunkWithBackpressure = async (dc: RTCDataChannel, chunk: ArrayBuffer) => {
  while (dc.bufferedAmount > CHUNK_SIZE * 2) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  dc.send(chunk);
};

export default function Home() {
  const name = useSelector((state: RootState) => state.user.name);
  const [greeting, setGreeting] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [transferStatus, setTransferStatus] = useState("");
  const [receivedFileName, setReceivedFileName] = useState("");
  const [sendProgress, setSendProgress] = useState(0);
  const [receiveProgress, setReceiveProgress] = useState(0);
  const [fileTotalSize, setFileTotalSize] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const receivedChunksRef = useRef<Uint8Array[]>([]);
  const fileAssembledRef = useRef(false);

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) setGreeting(`Good morning, ${name || "User"}!`);
    else if (hour < 18) setGreeting(`Good afternoon, ${name || "User"}!`);
    else setGreeting(`Good evening, ${name || "User"}!`);
  }, [name]);

  const resetSender = () => {
    setSelectedFile(null);
    setSessionId("");
    setSendProgress(0);
    setTransferStatus("");
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const resetReceiver = () => {
    setFileId("");
    setReceivedFileName("");
    setReceiveProgress(0);
    setFileTotalSize(0);
    setTransferStatus("");
    receivedChunksRef.current = [];
    fileAssembledRef.current = false;
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const handleCheckUpdate = () => {
    addToast({
      title: "Client is up to date!",
      description: "There is no update available.",
      timeout: 3000,
      shouldShowTimeoutProgess: true,
      color: "success"
    });
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setSessionId("");
      setSendProgress(0);
      setTransferStatus("");
      console.log("File dropped:", e.dataTransfer.files[0].name);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setSessionId("");
      setSendProgress(0);
      setTransferStatus("");
      console.log("File selected:", e.target.files[0].name);
    }
  };
  const handleClickArea = () => {
    fileInputRef.current?.click();
  };

  // --- Sender Logic ---
  const handleShareFile = async () => {
    if (!selectedFile) {
      addToast({
        title: "No file selected", description: "Please select a file first.",
        timeout: 3000,
        shouldShowTimeoutProgess: true,
        color: "warning"
      });
      return;
    }
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    setTransferStatus("Creating connection and generating offer...");

    const pc = new RTCPeerConnection({
      iceServers: [{urls: "stun:stun.l.google.com:19302"}],
    });
    peerConnectionRef.current = pc;

    const dc = pc.createDataChannel("fileTransfer");
    dataChannelRef.current = dc;

    dc.onopen = () => {
      setTransferStatus("Data channel open. Starting file transfer...");
      sendFileInChunks(selectedFile);
    };
    dc.onerror = (err) => {
      console.error("Data channel error:", err);
      setTransferStatus("Data channel error.");
      addToast({
        title: "Error", description: "Data channel error.", timeout: 3000,
        shouldShowTimeoutProgess: true,
        color: "danger"
      });
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);
      const localOffer = pc.localDescription;
      const offerData = {
        type: localOffer?.type,
        sdp: localOffer?.sdp,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      };
      if (localOffer) {
        await set(ref(realtimeDB, `signaling/${newSessionId}/offer`), offerData);
        setTransferStatus(`Offer created. Share this Session ID with your friend: ${newSessionId}`);
        pollForAnswer(newSessionId, pc);
      }
    } catch (err) {
      console.error("Error creating offer:", err);
      setTransferStatus("Error creating offer.");
      addToast({
        title: "Error", description: "Error creating offer.",
        timeout: 3000,
        shouldShowTimeoutProgess: true,
        color: "danger"
      });
    }
  };

  const pollForAnswer = (sessionId: string, pc: RTCPeerConnection) => {
    const answerRef = ref(realtimeDB, `signaling/${sessionId}/answer`);
    onValue(answerRef, async (snapshot) => {
      const answer = snapshot.val();
      if (answer) {
        try {
          await pc.setRemoteDescription(answer);
          setTransferStatus("Connection established. Sending file...");
          remove(answerRef);
        } catch (err) {
          console.error("Error setting remote description:", err);
          setTransferStatus("Error establishing connection.");
          addToast({
            title: "Error", description: "Error establishing connection.",
            timeout: 3000,
            shouldShowTimeoutProgess: true,
            color: "danger"
          });
        }
      }
    });
  };

  const sendFileInChunks = async (file: File) => {
    if (!dataChannelRef.current) return;
    const metadata = {type: "metadata", name: file.name, size: file.size};
    dataChannelRef.current.send(JSON.stringify(metadata));

    let offset = 0;
    while (offset < file.size) {
      const chunk = await readFileSlice(file, offset);
      await sendChunkWithBackpressure(dataChannelRef.current, chunk);
      offset += chunk.byteLength;
      const progress = Math.floor((offset / file.size) * 100);
      setSendProgress(progress);
      setTransferStatus(`Sending file: ${progress}%`);
    }
    await new Promise((resolve) => {
      const checkBuffer = () => {
        if (dataChannelRef.current && dataChannelRef.current.bufferedAmount === 0) {
          resolve(true);
        } else {
          setTimeout(checkBuffer, 50);
        }
      };
      checkBuffer();
    });
    console.log("Sending EOF message...");
    dataChannelRef.current.send(JSON.stringify({type: "EOF"}));
    setTransferStatus("File transfer complete.");
    addToast({
      title: "Success", description: "File sent successfully.",
      timeout: 3000,
      shouldShowTimeoutProgess: true,
      color: "success"
    });
    resetSender();
  };

  // --- Receiver Logic ---
  const handleReceiveFile = async () => {
    if (!fileId) {
      addToast({
        title: "No Session ID", description: "Please enter a valid Session ID.",
        timeout: 3000,
        shouldShowTimeoutProgess: true,
        color: "warning"
      });
      return;
    }
    setTransferStatus("Looking for offer...");
    const offerRef = ref(realtimeDB, `signaling/${fileId}/offer`);
    onValue(offerRef, async (snapshot) => {
      const offer = snapshot.val();
      if (offer) {
        remove(offerRef);
        const {fileName, fileSize} = offer;
        setReceivedFileName(fileName);
        setFileTotalSize(fileSize);

        const pc = new RTCPeerConnection({
          iceServers: [{urls: "stun:stun.l.google.com:19302"}],
        });
        peerConnectionRef.current = pc;

        pc.ondatachannel = (event) => {
          const dc = event.channel;
          dataChannelRef.current = dc;
          dc.onmessage = (e) => {
            try {
              const msg = JSON.parse(e.data);
              if (msg.type === "metadata") {
                return;
              }
              if (msg.type === "EOF") {
                setTransferStatus("File transfer complete. Saving file...");
                addToast({
                  title: "Success", description: "File received successfully.",
                  timeout: 3000,
                  shouldShowTimeoutProgess: true,
                  color: "success"
                });
                assembleFile();
                return;
              }
            } catch (error) {
            }
            if (e.data instanceof ArrayBuffer) {
              receivedChunksRef.current.push(new Uint8Array(e.data));
              const totalReceived = receivedChunksRef.current.reduce(
                (acc, chunk) => acc + chunk.length,
                0
              );
              if (fileTotalSize) {
                const progress = Math.floor((totalReceived / fileTotalSize) * 100);
                setReceiveProgress(progress);
                setTransferStatus(`Receiving file: ${progress}%`);
              }
            }
          };
          dc.onclose = () => {
            console.log("Data channel closed");
            if (!fileAssembledRef.current) {
              console.log("Data channel closed before EOF received, assembling file...");
              assembleFile();
            }
          };
        };

        try {
          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await waitForIceGathering(pc);
          const localAnswer = pc.localDescription;
          const answerData = {
            type: localAnswer?.type,
            sdp: localAnswer?.sdp,
          };
          if (localAnswer) {
            await set(ref(realtimeDB, `signaling/${fileId}/answer`), answerData);
            setTransferStatus("Connection established. Receiving file...");
          }
        } catch (err) {
          console.error("Error during answer creation:", err);
          setTransferStatus("Error during connection setup.");
          addToast({
            title: "Error", description: "Error during connection setup.",
            timeout: 3000,
            shouldShowTimeoutProgess: true,
            color: "danger"
          });
        }
      }
    });
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const assembleFile = () => {
    if (fileAssembledRef.current) return;
    fileAssembledRef.current = true;
    const chunks = receivedChunksRef.current;
    const blob = new Blob(chunks);
    console.log("Assembled blob:", blob);
    downloadBlob(blob, receivedFileName);
    setTransferStatus("File saved. Check your Downloads folder.");
    addToast({
      title: "Success", description: "File saved successfully.",
      timeout: 3000,
      shouldShowTimeoutProgess: true, color: "success"
    });
    resetReceiver();
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold">{greeting}</div>
        <div className="relative">
          <Dropdown backdrop="transparent">
            <DropdownTrigger>
              <Button variant="bordered" startContent={<Settings/>}>
                Settings
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Link Actions">
              <DropdownItem key="update" onPress={handleCheckUpdate}>
                Check for update
              </DropdownItem>
              <DropdownItem key="settings">Settings</DropdownItem>
              <DropdownItem key="about">About</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
      <Spacer y={2}/>
      <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
        <div className="flex-1 p-4 border rounded">
          <h2 className="text-lg font-bold mb-2">Send</h2>
          <div
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
              dragActive ? "border-blue-500" : "border-gray-300"
            }`}
            onClick={handleClickArea}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{position: "absolute", opacity: 0, width: "1px", height: "1px", zIndex: -1}}
              onChange={handleFileChange}
            />
            {selectedFile ? (
              <div className="text-lg font-medium">{selectedFile.name}</div>
            ) : (
              <div className="text-lg text-gray-500">Drag & drop your file here or click to select</div>
            )}
          </div>
          <Spacer y={2}/>
          {selectedFile && (
            <div>
              {!sessionId ? (
                <Button onPress={handleShareFile}>Share File</Button>
              ) : (
                <div>
                  <div>
                    <strong>Session ID:</strong> <p className="select-all">{sessionId}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    Share this ID with your friend to start the transfer.
                  </div>
                </div>
              )}
              <Spacer y={2}/>
              {sessionId && <Progress showValueLabel={sendProgress != 0} isIndeterminate={sendProgress == 0} value={sendProgress}/>}
            </div>
          )}
        </div>
        <div className="flex-1 p-4 border rounded">
          <h2 className="text-lg font-bold mb-2">Receive</h2>
          <div className="p-2">
            <Input
              fullWidth
              label="Enter Session ID to receive file"
              placeholder="Session ID"
              value={fileId}
              onChange={(e) => setFileId(e.target.value)}
            />
            <Spacer y={1}/>
            <Button onPress={handleReceiveFile}>Receive File</Button>
          </div>
          <Spacer y={2}/>
          {receivedFileName && (
            <div className="p-2 border rounded">
              <div className="mb-2">
                <strong>Receiving:</strong> {receivedFileName}
              </div>
              <Progress showValueLabel={receiveProgress != 0} isIndeterminate={receiveProgress == 0} value={receiveProgress}/>
            </div>
          )}
        </div>
      </div>
      <Spacer y={2}/>
      {transferStatus && <div className="text-sm text-center">{transferStatus}</div>}
    </div>
  );
}
