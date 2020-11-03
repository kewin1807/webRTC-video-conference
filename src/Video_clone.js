import React, { useRef, useState, useEffect } from 'react'
import io from 'socket.io-client'
import faker from "faker"

import { IconButton, Badge } from '@material-ui/core'
import VideocamIcon from '@material-ui/icons/Videocam'
import VideocamOffIcon from '@material-ui/icons/VideocamOff'
import MicIcon from '@material-ui/icons/Mic'
import MicOffIcon from '@material-ui/icons/MicOff'
import ScreenShareIcon from '@material-ui/icons/ScreenShare'
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare'
import CallEndIcon from '@material-ui/icons/CallEnd'
import ChatIcon from '@material-ui/icons/Chat'

import { Input, Button, Alert, message } from 'antd'
import 'antd/dist/antd.css'

import { Row } from 'reactstrap'
import Modal from 'react-bootstrap/Modal'
import 'bootstrap/dist/css/bootstrap.css'
import "./Video.css"
import { useStateWithCallbackLazy } from 'use-state-with-callback';

var socket = null
var socketId = null
var elms = 0
var connections = {}
const server_url = process.env.NODE_ENV === 'production' ? 'https://webrtc-videoconference.herokuapp.com' : "http://localhost:4001"

const peerConnectionConfig = {
    'iceServers': [
        // { 'urls': 'stun:stun.services.mozilla.com' },
        { 'urls': 'stun:stun.l.google.com:19302' },
    ]
}

const Video = ({ location, ...props }) => {
    const localVideoref = useRef();
    let videoAvailable = false;
    let audioAvailable = false;
    const roomnames = window.location.href.split("/")
    const roomname = roomnames[roomnames.length - 1];
    const [video, setVideo] = useStateWithCallbackLazy(false);
    const [audio, setAudio] = useStateWithCallbackLazy(false);
    const [screen, setScreen] = useState(false);
    const [modal, showModal] = useState(false);
    const [screenAvailable, setScreenAvailable] = useState(false);
    const [messages, setMessages] = useState([]);
    const [messageText, setMessage] = useState("");
    const [password, setPassword] = useState("");
    const [newmessages, setNewMessages] = useState(0);
    const [username, setUsername] = useState(location && location.state && location.state.username ? location.state.username : faker.internet.userName());
    const [askForUsername, showAskForUsername] = useStateWithCallbackLazy(location && location.state && location.state.username ? false : true);
    const [error, setError] = useState("");
    connections = {}

    useEffect(() => {
        getPermissions();
        if (location && location.state && location.state.username) {
            getUserMedia();
            connectToSocketServer();
        }
    }, [])

    const getPermissions = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true })
                .then(() => videoAvailable = true)
                .catch(() => videoAvailable = false)
            await navigator.mediaDevices.getUserMedia({ audio: true })
                .then(() => audioAvailable = true)
                .catch(() => audioAvailable = false)
            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true)
            } else {
                setScreenAvailable(false);
            }
            if (videoAvailable || audioAvailable) {
                navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable })
                    .then((stream) => {
                        setVideo(videoAvailable);
                        setAudio(audioAvailable)
                        window.localStream = stream
                        localVideoref.current.srcObject = stream
                    })
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
        catch (e) { console.log(e) }
    }

    const getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable, () => {
            getUserMedia();
            connectToSocketServer();
        })
    }

    const getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        }
        else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }

    const getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        }
        catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketId) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(true);
            setAudio(false, () => {
                try {
                    let tracks = localVideoref.current.srcObject.getTracks()
                    tracks.forEach(track => track.stop())
                } catch (e) { console.log(e) }

                let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                window.localStream = blackSilence()
                localVideoref.current.srcObject = window.localStream

                for (let id in connections) {
                    connections[id].addStream(window.localStream)

                    connections[id].createOffer().then((description) => {
                        connections[id].setLocalDescription(description)
                            .then(() => {
                                socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                            })
                            .catch(e => console.log(e))
                    })
                }
            })

        })
    }

    const getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
    }
    const getDislayMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketId) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false, () => {
                try {
                    let tracks = localVideoref.current.srcObject.getTracks()
                    tracks.forEach(track => track.stop())
                } catch (e) { console.log(e) }

                let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                window.localStream = blackSilence()
                localVideoref.current.srcObject = window.localStream

                getUserMedia()
            })
        })
    }

    const gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketId) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socket.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }

    const changeCssVideos = (main) => {
        let widthMain = main.offsetWidth
        let minWidth = "30%"
        if ((widthMain * 30 / 100) < 300) {
            minWidth = "300px"
        }
        let minHeight = "40%"

        let height = String(100 / elms) + "%"
        let width = ""
        if (elms === 0 || elms === 1) {
            width = "100%"
            height = "100%"
        } else if (elms === 2) {
            width = "45%"
            height = "100%"
        } else if (elms === 3 || elms === 4) {
            width = "35%"
            height = "50%"
        } else {
            width = String(100 / elms) + "%"
        }

        let videos = main.querySelectorAll("video")
        for (let a = 0; a < videos.length; ++a) {
            videos[a].style.minWidth = minWidth
            videos[a].style.minHeight = minHeight
            videos[a].style.setProperty("width", width)
            videos[a].style.setProperty("height", height)
        }

        return { minWidth, minHeight, width, height }
    }

    const connectToSocketServer = () => {
        if (!socket) {
            socket = io.connect(server_url, { secure: true })
        }

        socket.on('signal', gotMessageFromServer)

        socket.on('connect', () => {
            const passwordRef = location.state && location.state.password ? location.state.password : password
            socket.emit('join-call', window.location.href, passwordRef)
            socketId = socket.id

            socket.on('chat-message', addMessage)

            socket.on('user-left', (id) => {
                let video = document.querySelector(`[data-socket="${id}"]`)
                if (video !== null) {
                    elms--
                    video.parentNode.removeChild(video)

                    let main = document.getElementById('main')
                    changeCssVideos(main)
                }
            })

            socket.on('user-joined', (id, clients) => {

                console.log("number_of_clients: ", clients.length)

                clients.forEach((socketListId) => {
                    connections[socketListId] = new RTCPeerConnection(peerConnectionConfig)
                    // Wait for their ice candidate       
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null && socket) {
                            console.log("socket: ", socket)
                            socket.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

                    // Wait for their video stream
                    connections[socketListId].onaddstream = (event) => {
                        // TODO mute button, full screen button
                        var searchVidep = document.querySelector(`[data-socket="${socketListId}"]`)
                        if (searchVidep !== null) { // if i don't do this check it make an empyt square
                            searchVidep.srcObject = event.stream
                        } else {
                            elms = clients.length
                            let main = document.getElementById('main')
                            let cssMesure = changeCssVideos(main)

                            let video = document.createElement('video')

                            let css = {
                                minWidth: cssMesure.minWidth, minHeight: cssMesure.minHeight, maxHeight: "100%", margin: "10px",
                                borderStyle: "solid", borderColor: "#bdbdbd", objectFit: "fill"
                            }
                            for (let i in css) video.style[i] = css[i]

                            video.style.setProperty("width", cssMesure.width)
                            video.style.setProperty("height", cssMesure.height)
                            video.setAttribute('data-socket', socketListId)
                            video.srcObject = event.stream
                            video.autoplay = true
                            video.playsinline = true

                            main.appendChild(video)
                        }
                    }

                    // Add the local video stream
                    if (window.localStream !== undefined && window.localStream !== null) {
                        connections[socketListId].addStream(window.localStream)
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        connections[socketListId].addStream(window.localStream)
                    }
                })

                if (id === socketId) {
                    for (let id2 in connections) {
                        if (id2 === socketId) continue

                        try {
                            connections[id2].addStream(window.localStream)
                        } catch (e) { }

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socket.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }
    const silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }
    const black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }
    const handleVideo = () => {
        const videoStatus = !video
        setVideo(videoStatus, () => {
            getUserMedia();
        })
    }

    const handleAudio = () => {
        const audioStatus = !audio;
        setAudio(audioStatus, () => {
            getUserMedia();
        })
    }

    const handleScreen = () => {
        const screenStatus = !screen
        setScreen(screenStatus);
        getDislayMedia();
    }
    const handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        window.location.href = "/"
    }
    const openChat = () => {
        showModal(true);
        setNewMessages(0);
    }
    const closeChat = () => {
        showModal(false);
    }
    const handleMessage = (e) => setMessage(e.target.value)
    const addMessage = (data, sender, socketIdSender) => {
        const previousMessage = messages;
        setMessages([...previousMessage, { "sender": sender, "data": data }]);
        if (socketIdSender !== socketId) {
            setNewMessages(newmessages + 1)
        }
    }
    const handleUsername = (e) => setUsername(e.target.value)
    const handlePassword = (e) => setPassword(e.target.value)
    const sendMessage = () => {
        socket.emit('chat-message', messageText, username)
        setMessage("");
    }
    const copyUrl = () => {
        let text = window.location.href
        if (!navigator.clipboard) {
            let textArea = document.createElement("textarea")
            textArea.value = text
            document.body.appendChild(textArea)
            textArea.focus()
            textArea.select()
            try {
                document.execCommand('copy')
                message.success("Link copied to clipboard!")
            } catch (err) {
                message.error("Failed to copy")
            }
            document.body.removeChild(textArea)
            return
        }
        navigator.clipboard.writeText(text).then(function () {
            message.success("Link copied to clipboard!")
        }, () => {
            message.error("Failed to copy")
        })
    }

    const connect = () => {
        socket = io.connect(server_url, { secure: true })

        // check authentication
        socket.on("connect", () => {
            socket.emit('auth', window.location.href, password);

            socket.on("accept", (res) => {
                if (res && res.status === 401) {
                    setError(res.message)
                }
                else {
                    socket = null;
                    showAskForUsername(false, () => {
                        getMedia();
                    });

                    // this.setState({ askForUsername: false }, () => this.getMedia())
                }
            })
        })
    }
    const isChrome = function () {
        let userAgent = (navigator && (navigator.userAgent || '')).toLowerCase()
        let vendor = (navigator && (navigator.vendor || '')).toLowerCase()
        let matchChrome = /google inc/.test(vendor) ? userAgent.match(/(?:chrome|crios)\/(\d+)/) : null
        // let matchFirefox = userAgent.match(/(?:firefox|fxios)\/(\d+)/)
        // return matchChrome !== null || matchFirefox !== null
        return matchChrome !== null
    }
    if (!isChrome) {
        return (
            <div style={{
                background: "white", width: "30%", height: "auto", padding: "20px", minWidth: "400px",
                textAlign: "center", margin: "auto", marginTop: "50px", justifyContent: "center"
            }}>
                <h1>Sorry, this works only with Google Chrome</h1>
            </div>
        )
    }
    return (
        <div>
            {askForUsername === true ?
                <div>
                    <div style={{
                        background: "white", width: "30%", height: "auto", padding: "20px", minWidth: "400px",
                        textAlign: "center", margin: "auto", marginTop: "50px", justifyContent: "center"
                    }}>
                        <p style={{ margin: 0, fontWeight: "bold", paddingRight: "50px" }}>{`Connect the room ${roomname}`}</p>
                        <Input placeholder="Username" value={username} onChange={e => handleUsername(e)} />

                        <Input.Password placeholder="Password room" value={password} onChange={e => handlePassword(e)} />

                        {error && error !== "" ? (
                            <Alert message={error} type="error" />
                        ) : null}
                        <Button variant="contained" color="primary" onClick={connect} style={{ margin: "20px" }}>Connect</Button>
                    </div>

                    <div style={{ justifyContent: "center", textAlign: "center", paddingTop: "40px" }}>
                        <video id="my-video" ref={localVideoref} autoPlay muted style={{
                            borderStyle: "solid", borderColor: "#bdbdbd", objectFit: "fill", width: "60%", height: "30%"
                        }}></video>
                    </div>
                </div>
                :
                <div>
                    <div className="btn-down" style={{ backgroundColor: "whitesmoke", color: "whitesmoke", textAlign: "center" }}>
                        <IconButton style={{ color: "#424242" }} onClick={handleVideo}>
                            {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>

                        <IconButton style={{ color: "#f44336" }} onClick={handleEndCall}>
                            <CallEndIcon />
                        </IconButton>

                        <IconButton style={{ color: "#424242" }} onClick={handleAudio}>
                            {audio === true ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>

                        {screenAvailable === true ?
                            <IconButton style={{ color: "#424242" }} onClick={handleScreen}>
                                {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton>
                            : null}

                        <Badge badgeContent={newmessages} max={999} color="secondary" onClick={openChat}>
                            <IconButton style={{ color: "#424242" }} onClick={openChat}>
                                <ChatIcon />
                            </IconButton>
                        </Badge>
                    </div>

                    <Modal show={modal} onHide={closeChat} style={{ zIndex: "999999" }}>
                        <Modal.Header closeButton>
                            <Modal.Title>Chat Room</Modal.Title>
                        </Modal.Header>
                        <Modal.Body style={{ overflow: "auto", overflowY: "auto", height: "400px", textAlign: "left" }} >
                            {messages.length > 0 ? messages.map((item, index) => (
                                <div key={index} style={{ textAlign: "left" }}>
                                    <p style={{ wordBreak: "break-all" }}><b>{item.sender}</b>: {item.data}</p>
                                </div>
                            )) : <p>No message yet</p>}
                        </Modal.Body>
                        <Modal.Footer className="div-send-msg">
                            <Input placeholder="Message" value={messageText} onChange={e => handleMessage(e)} />
                            <Button variant="contained" color="primary" onClick={sendMessage}>Send</Button>
                        </Modal.Footer>
                    </Modal>

                    <div className="container">
                        <div style={{ paddingTop: "20px" }}>
                            <Input value={window.location.href} disable="true"></Input>
                            <Button style={{
                                backgroundColor: "#3f51b5", color: "whitesmoke", marginLeft: "20px",
                                marginTop: "10px", width: "120px", fontSize: "10px"
                            }} onClick={copyUrl}>Copy invite link</Button>
                        </div>

                        <Row id="main" className="flex-container" style={{ margin: 0, padding: 0 }}>
                            <video id="my-video" ref={localVideoref} autoPlay muted style={{
                                borderStyle: "solid", borderColor: "#bdbdbd", margin: "10px", objectFit: "fill",
                                width: "100%", height: "100%"
                            }}></video>
                        </Row>
                    </div>
                </div>
            }
        </div>
    )
}

export default Video