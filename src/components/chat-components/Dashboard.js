import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Alert, Form } from "react-bootstrap";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebase";
import {
  onSnapshot,
  doc,
  collection,
  addDoc,
  orderBy,
  query,
  deleteDoc,
  updateDoc,
  getDocs,
  setDoc,
  where,
  arrayUnion
} from "firebase/firestore";

export default function Dashboard() {
  const [error, setError] = useState();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const textMessageRef = useRef("");
  const emailSearchRef = useRef("");
  const [activeChats, setActiveChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [placeholderChat, setPlaceholderChat] = useState([]);
  const [clientData, setClientData] = useState({});
  const [activeChat, setActiveChat] = useState("");
  const [activeReceiver, setActiveReceiver] = useState("");
  const [users, setUsers] = useState([]);

  /*  
  Get user data from the database and set the user uuid in state
*/
    
  console.log("Rendered Dashboard")

  useEffect(() => {
    

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

    const q = query(collection(db, "chats"), where("participantsFilterArr", "array-contains", currentUser.uid));

    onSnapshot(q, (querySnapshot) => {
      const dbChats = [];
      querySnapshot.forEach((doc) => {
        dbChats.push(doc.data());
    });
      setActiveChats(dbChats)
    });

  }, []);

  /*  
  Set database link for active chat
*/

  useEffect(() => {
    if(activeChat) {
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

      setMessages(messageData);
    });

    onSnapshot(doc(db, `chats/${activeChat}`), (snapshot) => {
      if (snapshot.exists()) {
        const docData = snapshot.data();
        if(docData.privateChat) {
            if(docData.participants[0].uuid !== currentUser.uid) {
              setActiveReceiver({username: docData.participants[0].username, receiverUid: docData.participants[0].uuid})
            } else {
              setActiveReceiver({username: docData.participants[1].username, receiverUid: docData.participants[1].uuid})
            }
          } else {
            setActiveReceiver({username: docData.groupName, receiverUid: docData.id})
          }
        }
      });
  }

  }, [activeChat]);

  async function handleLogout() {
    setError("");

    try {
      await logout();
      navigate("/login");
    } catch {
      setError("Failed to logout");
    }
  }

  function handleSubmit() {
    if(textMessageRef.current.value === "" || textMessageRef.current.value.length > 500) {
      return
    }
    const messagesRef = collection(
      db,
      "messages",
      `${activeChat}`,
      "chatMessages"
    );

    const chatRef = doc(
      db,
      "chats",
      `${activeChat}`
    )

    if(!clientData.participatingChats.includes(activeChat)) {

      const newChatEntry = {
        createdAt: new Date(),
        createdBy: "",
        groupName: "",
        id: activeChat,
        lastMessage: "",
        participants: [{username: clientData.username, uuid: currentUser.uid}, {username: activeReceiver.username, uuid: activeReceiver.receiverUid}],
        participantsFilterArr: [currentUser.uid, activeReceiver.receiverUid],
        privateChat: true,
      };

      setDoc(chatRef, newChatEntry)

      updateDoc(chatRef, {
          lastMessage: textMessageRef.current.value,
        })

      updateDoc(doc(db, `users/${currentUser.uid}`), {
        participatingChats: arrayUnion(activeChat),
      })

      updateDoc(doc(db, `users/${activeReceiver.receiverUid}`), {
        participatingChats: arrayUnion(activeChat),
      })


    } else {
      updateDoc(chatRef, {
        lastMessage: textMessageRef.current.value
      })
      
    }

    addDoc(messagesRef, {
      message: textMessageRef.current.value,
      sentBy: currentUser.uid,
      sentTo: activeReceiver.receiverUid,
      timestamp: new Date(),
    });
    
    textMessageRef.current.value = "";
  }

  function renderMessages(messages) {
    if (messages) {
    }
    return messages.map((messageCol) => {
      let fromReceiver = false;
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


  async function getUserByEmail(email) {

    const usersQuery = query(collection(db, `users`), where("email", "==", email))

    const usersArray = []

    const usersSnapshot = await getDocs(usersQuery)

    console.log('usersSnapshot', usersSnapshot)
    
    usersSnapshot.forEach((doc) => {
        const userItem = {
          id: doc.id,
          username: doc.data().username,
          email: email
        }

        usersArray.push(userItem)
    })
    setUsers(usersArray)
  }

  function renderAllUsers(users) {
      if(users.length !== 0) {
        return users.map(user => {
          return <div><p
              style={{
                border: `1px solid black`,
                background: `lightgray`,
              }}
              key={user.id}
              id={user.id}
              onClick={startChat}
            >
              {user.username}
            </p>
            </div>
        });
      }
      
  }

  function handleSearchUser(event) {

    event.preventDefault()

    getUserByEmail(emailSearchRef.current.value)

  }

  function startChat(event) {
    event.preventDefault();

    if(currentUser.uid === event.target.id) {
      return
    }

    let newChatId

    if(currentUser.uid < event.target.id) {
      newChatId = currentUser.uid.concat(event.target.id)
    } else {
      newChatId = event.target.id.concat(currentUser.uid)
    }

    setPlaceholderChat([{
      createdAt: new Date(),
      createdBy: "",
      groupName: "",
      id: newChatId,
      lastMessage: "",
      participants: [{username: clientData.username, uuid: currentUser.uid}, {username: event.target.outerText, uuid: event.target.id}],
      participantsFilterArr: [currentUser.uid, event.target.id],
      privateChat: true,
    }]);

    setActiveChat(newChatId)
    setActiveReceiver({username: event.target.outerText, receiverUid: event.target.id})
  }

  function renderActiveChats(chats) {
    
    if (chats) {
      return chats.map((chat) => {
          if (chat) {
            return (
              <div 
              style={{
                border: `1px solid black`,
                background: chat.id === activeChat ? "lightgray" : "white",
                margin: "10px",
              }}>
                <p
                  style={{
                    border: `1px solid black`,
                    background: chat.id === activeChat ? "lightgray" : "white",
                  }}
                  key={chat.id}
                  id={chat.id}
                  onClick={(e) => setActiveChat(e.target.id)}
                >
                  {getChatName(chat)}
                </p>
                <p>
                {chat.lastMessage.length === 0 ? "Start a new chat!" : `Last message: ${chat.lastMessage.length > 33 ? chat.lastMessage.slice(0, 30) + "..." : chat.lastMessage}`}
                </p>
              </div>
            );
          } else {
            console.log("Could not get user");
            return null
          }
        
      });
    } else {
      console.log("no chats available")
    }
  }



  function getChatName(chatData) {
    if(chatData.privateChat) {
      if(chatData.participants[0].uuid === currentUser.uid) {
        return chatData.participants[1].username
      } else {
        return chatData.participants[0].username
      }
    } else {
      return chatData.groupName
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
            <h5 className="text-center mb-4">Users</h5>
            <Form className="mb-3" onSubmit={(event) => {event.preventDefault()}}>
              <Form.Group id="chat">
                <Form.Control
                  type="input"
                  placeholder="Search user by email address"
                  ref={emailSearchRef}
                  onChange={handleSearchUser}
                  required
                />
              </Form.Group>
              {/* <Button
                className="w-100 btn btn-primary mt-2 mb-2"
                type="button"
                onClick={handleSearchUser}
              >
                Send
              </Button> */}
            </Form>
            <div
              style={{
                border: "1px solid gray",
                borderRadius: "5px",
                marginBottom: "10px",
                height: "660px",
              }}
            >
              {renderAllUsers(users)}
            </div>
          </Card.Body>
        </Card>
        <Card className="flex-grow-1">
          <Card.Body>
            <h5 className="text-center mb-4">Chats</h5>
            <div
              style={{
                border: "1px solid gray",
                borderRadius: "5px",
                marginBottom: "10px",
                height: "660px",
              }}
            >
              {placeholderChat.length > 0 && !activeChats.some(chat => chat.id === placeholderChat[0].id) && renderActiveChats(placeholderChat)}
              {renderActiveChats(activeChats)}
            </div>
          </Card.Body>
        </Card>
        <Card style={{ width: "50%" }}>
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
              {messages ? renderMessages(messages) : ""}
            </div>
            <Form onSubmit={(event) => {event.preventDefault()}}>
              <Form.Group id="chat">
                <Form.Control
                  type="input"
                  placeholder="Write message"
                  ref={textMessageRef}
                  required
                  disabled={activeChat === ''}
                  hidden={activeChat === ''}
                />
              </Form.Group>
              <Button
                className="w-100 btn btn-primary mt-2"
                type="button"
                onClick={handleSubmit}
                disabled={activeChat === ''}
                hidden={activeChat === ''}
              >
                Send
              </Button>
            </Form>
            <strong>Username:</strong> {clientData.username}
            {/* <Button className="mt-2">Change username</Button> */}
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
