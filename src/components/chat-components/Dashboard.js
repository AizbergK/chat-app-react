import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Alert, Form } from "react-bootstrap";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebase";
import {
  onSnapshot,
  doc,
  getDoc,
  collection,
  addDoc,
  orderBy,
  query,
  deleteDoc
} from "firebase/firestore";

export default function Dashboard() {
  const [error, setError] = useState();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [textMessage, setTextMessage] = useState("");
  const [testMessages, setTestMessages] = useState([]);
  const [clientData, setClientData] = useState({});
  const [activeChat, setActiveChat] = useState(
    "BuHwqtxa9bXvypxeDb6xezFaAZ43dbKkGCzzTHPpUdwxyh3zCphRfQD3"
  );
  // const [participatingChats, setParticipatingChats] = useState([]);
  const [activeReceiver, setActiveReceiver] = useState(
    ""
  );

  /*  
  Get user data from the database and set the user uuid in state
*/
    

  useEffect(() => {
    //   (async () => {
    //   const docRef = doc(db, `users/${currentUser.uid}`);
    //   const docSnap = await getDoc(docRef);

    //   if (docSnap.exists()) {
    //     const {username, participatingChats, email} = docSnap.data();
    //     setClientData({username: username, participatingChats: participatingChats, email: email});
    //   } else {
    //     
    //   }
    // })()

    onSnapshot(doc(db, `users/${currentUser.uid}`), (snapshot) => {
      if (snapshot.exists()) {
        const { username, participatingChats, email } = snapshot.data();
        setClientData({
          username: username,
          participatingChats: participatingChats,
          email: email,
        });
      } else {
        console.log("Could not get user");
      }
    });

      (async () => {
        const docRef = doc(db, `chats/${activeChat}`);
        const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const docData = docSnap.data();
        if(docData.privateChat) {
            if(docData.participants[0] !== currentUser.uid) {
              const usernameRef = doc(db, `users/${docData.participants[0]}`)
              const userUsername = await getDoc(usernameRef)
              console.log('userUsername.data().username', userUsername)
              setActiveReceiver({username: userUsername.data().username, receiverUid: docData.participants[0]})
            } else {
              const usernameRef = doc(db, `users/${docData.participants[1]}`)
              const userUsername = await getDoc(usernameRef)
              console.log('userUsername.data().username', userUsername.data())
              setActiveReceiver({username: userUsername.data().username, receiverUid: docData.participants[1]})
            }
          } else {
            setActiveReceiver({username: docData.groupName, receiverUid: docData.id})
          }
          
        }
      })()

  }, []);

  /*  
  Set database link for active chat
*/

  useEffect(() => {
    const messagesRef = collection(
      db,
      "messages",
      `${activeChat}`,
      "chatMessages"
    );

    onSnapshot(query(messagesRef, orderBy("timestamp")), (snapshot) => {
      let messageData = [];
      snapshot.docs.forEach((doc) => {
        messageData.push({ ...doc.data(), key: doc.id });
      });

      setTestMessages(messageData);
    });
  }, []);

  async function handleLogout() {
    setError("");

    try {
      await logout();
      navigate("/login");
    } catch {
      setError("Failed to logout");
    }
  }

  function handleMessageState(event) {
    setTextMessage(event.target.value);

    // console.log("here", testMessages, activeReceiver);
  }

  function handleSubmit() {
    if(textMessage === "") {
      return
    }
    const messagesRef = collection(
      db,
      "messages",
      `${activeChat}`,
      "chatMessages"
    );
    addDoc(messagesRef, {
      message: textMessage,
      sentBy: currentUser.uid,
      sentTo: activeReceiver.receiverUid,
      timestamp: new Date(),
    });

    setTextMessage("");
  }

  function renderMessages(messages = testMessages) {
    if (messages) {
    }
    return messages.map((messageCol) => {
      let fromReceiver = false;
      // console.log(currentUser.uid)
      if (messageCol.sentBy === currentUser.uid) {
        fromReceiver = false;
      } else {
        fromReceiver = true;
      }
      return (
        <p
          style={{
            border: `1px solid ${fromReceiver ? "red" : "green"}`,
            background: `${fromReceiver ? "#FFCCCB" : "lightgreen"}`,
            margin: "10px",
          }}
          key={messageCol.key}
          id={messageCol.key}
          onClick={removeMessage}
        >
          {messageCol.message}
        </p>
      );
    });
  }

  function renderActiveChats(chats) {
    if (chats) {
      return chats.map((chat) => {
        return (
          <p
            style={{
              border: `1px solid black`,
              background: `lightgray`,
              margin: "10px",
            }}
            key={chat}
            id={chat}
          >
            {chat}
          </p>
        );
      });
    } else {
    }
  }

  async function removeMessage(event) {
    event.preventDefault()
    await deleteDoc(doc(db, "messages", `${activeChat}`, "chatMessages", `${event.target.id}`))
  }

  return (
    <>
      <Card className="d-flex flex-row">
        <Card className="flex-grow-1">
          <Card.Body>
            <h5 className="text-center mb-4">To: {activeReceiver.username}</h5>
            <div
              style={{
                border: "1px solid gray",
                borderRadius: "5px",
                marginBottom: "10px",
                height: "660px",
              }}
            >
              {renderActiveChats(clientData.participatingChats)}
            </div>
          </Card.Body>
        </Card>
        <Card style={{ width: "65%" }}>
          <Card.Body>
            <h5 className="text-center mb-4">To: {activeReceiver.username}</h5>
            {error && <Alert variant="danger">{error}</Alert>}
            <div className="overflow-auto"
              style={{
                border: "1px solid gray",
                borderRadius: "5px",
                marginBottom: "10px",
                height: "500px",
              }}
            >
              {testMessages ? renderMessages(testMessages) : ""}
            </div>
            <Form onSubmit={(event) => {event.preventDefault()}}>
              <Form.Group id="chat">
                <Form.Control
                  type="input"
                  placeholder="Write message"
                  value={textMessage}
                  onChange={handleMessageState}
                  required
                />
              </Form.Group>
              <Button
                className="w-100 btn btn-primary mt-2"
                type="button"
                onClick={handleSubmit}
              >
                Send
              </Button>
            </Form>
            <strong>Username:</strong> {clientData.username}
          </Card.Body>
          <div className="w-100 text-center mt-2">
            <Button variant="link" onClick={handleLogout}>
              Log Out
            </Button>
          </div>
        </Card>
      </Card>
    </>
  );
}
