import {AuthUserContext} from "../Session";
import Meta from "antd/lib/card/Meta";

import emoji from 'emoji-dictionary';
import 'emoji-mart/css/emoji-mart.css'


import {Card, Divider, Form, Input, Layout, List, Tooltip} from 'antd';
import "./chat.css"
import React from "react";
import ReactMarkdown from "react-markdown";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";

const emojiSupport = text => text.value.replace(/:\w+:/gi, name => emoji.getUnicode(name));

const linkRenderer = props => <a href={props.href} target="_blank">{props.children}</a>;

const {Header, Content, Footer, Sider} = Layout;

var moment = require('moment');
const INITIAL_STATE = {
    expanded: true,
    chatLoading: true,
    token: '',
    chatReady: false,
    messages: [],
    profiles: [],
    authors: {},
    loadingChannels: true,
    chatHeight: "400px",
    groupedMessages: [],
    newMessage: ''
};

class SidebarChat extends React.Component {
    constructor(props) {
        super(props);

        this.messages = {};
        let siderWidth = Number(localStorage.getItem("chatWidth"));
        console.log("Read: " + siderWidth)
        if(siderWidth == 0)
            siderWidth = 250;
        else if(siderWidth == -1)
            siderWidth = 0;
        this.state = {...INITIAL_STATE, chatChannel: "#general", siderWidth: siderWidth}

    }

    formatTime(timestamp) {
        return <Tooltip title={moment(timestamp).calendar()}>{moment(timestamp).format('LT')}</Tooltip>
    }

    async componentDidMount() {
        this.changeChannel("#general");
    }

    async changeChannel(uniqueNameOrSID) {
        let user = this.props.auth.user;
        console.log("Change channel: " + uniqueNameOrSID)
        if(uniqueNameOrSID == this.currentUniqueName && this.props.auth.currentConference == this.currentConference)
            return;
        this.currentConference = this.props.auth.currentConference;
        this.currentUniqueName = uniqueNameOrSID
        if (user && uniqueNameOrSID) {
            if (!this.client) {
                this.client = await this.props.auth.chatClient.initChatClient(user, this.props.auth.currentConference);
            }
            this.setState({
                chatLoading: true,
                messages: []
            }, async () => {
                if(this.currentUniqueName != uniqueNameOrSID){
                    return;//raced with another update
                }
                if (this.activeChannel) {
                    //leave the current channel
                    console.log("Leaving: ")
                    this.activeChannel.removeAllListeners("messageAdded");
                    this.activeChannel.removeAllListeners("messageRemoved");
                    this.activeChannel.removeAllListeners("messageUpdated");
                    //we never actually leave a private channel because it's very hard to get back in
                    // - we need to be invited by the server, and that's a pain...
                    //we kick users out when they lose their privileges to private channels.
                    if (this.activeChannel.type !== "private")
                        await this.activeChannel.leave();
                }
                this.activeChannel = await this.props.auth.chatClient.joinAndGetChannel(uniqueNameOrSID);
                this.activeChannel.getMessages().then((messages)=> {
                    if(this.currentUniqueName != uniqueNameOrSID)
                        return;
                    this.messagesLoaded(this.activeChannel, messages)
                });
                this.activeChannel.on('messageAdded', this.messageAdded.bind(this, this.activeChannel));
                this.activeChannel.on("messageRemoved", this.messageRemoved.bind(this, this.activeChannel));
                this.activeChannel.on("messageUpdated", this.messageUpdated.bind(this, this.activeChannel));
                console.log(this.activeChannel)
               let stateUpdate = {
                    chatLoading: false,
                   activeChannelName: (this.activeChannel.friendlyName ? this.activeChannel.friendlyName : this.activeChannel.uniqueName)
               }
               console.log("Changing active channel name to: " + stateUpdate.activeChannelName)
               if(!uniqueNameOrSID.startsWith("#"))
               {
                   if(this.state.siderWidth == 0)
                       stateUpdate.siderWidth = 250;
               }
                this.setState(stateUpdate);
            });

        } else {
            if(this.currentUniqueName != uniqueNameOrSID){
                return;//raced with another update
            }
            // console.log("Unable to set channel because no user or something:")
            // console.log(user);
            // console.log(uniqueNameOrSID)
            this.setState({
                chatAvailable: false,
                // siderWidth: 0,
                meesages: []
            })
        }

    }

    groupMessages(messages) {
        let ret = [];
        let lastMessage = undefined;
        if (!messages)
            return undefined;
        let _this = this;

        for (let message of messages) {
            if (!lastMessage || message.author != lastMessage.author || moment(message.timestamp).diff(lastMessage.timestamp, 'minutes') > 5) {
                if (lastMessage)
                    ret.push(lastMessage);
                let authorID = message.author;
                if (!this.state.authors[authorID]) {
                    this.props.auth.helpers.getUserRecord(authorID).then((user) => {
                        _this.setState((prevState) => ({
                            authors: {...prevState.authors, [authorID]: (user ? user.get("displayName") : authorID)}
                        }))
                    })
                }

                lastMessage = {
                    author: message.author,
                    timestamp: message.timestamp,
                    messages: [message],
                    sid: message.sid
                };
            } else {
                lastMessage.messages.push(message);
            }
        }
        if (lastMessage)
            ret.push(lastMessage);
        this.setState({groupedMessages: ret});

    }

    messagesLoaded = (channel, messagePage) => {
        this.messages[channel.uniqueName] = messagePage.items
        this.groupMessages(this.messages[channel.uniqueName]);

    };
    messageAdded = (channel, message) => {
        this.messages[channel.uniqueName].push(message);
        this.groupMessages(this.messages[channel.uniqueName]);

    };

    messageRemoved = (channel, message) => {
        this.messages[channel.uniqueName] = this.messages[channel.uniqueName].filter((v) => v.sid != message.sid)
        this.groupMessages(this.messages[channel.uniqueName]);
    };
    messageUpdated = (channel, message) => {
        this.messages[channel.uniqueName] = this.messages[channel.uniqueName].map(m => m.sid == message.sid ? message : m)
        this.groupMessages(this.messages[channel.uniqueName]);
    };

    onMessageChanged = event => {
        this.setState({newMessage: event.target.value});
    };

    sendMessage = event => {
        const message = this.state.newMessage;
        this.setState({newMessage: ''});
        this.activeChannel.sendMessage(message);
    };

    deleteMessage(message) {
        message.remove();
    }

    areEqualID(o1, o2) {
        if (!o1 && !o2)
            return true;
        if (!o1 || !o2)
            return false;
        return o1.id == o2.id;
    }
    areEqualSID(o1, o2) {
        if (!o1 && !o2)
            return true;
        if (!o1 || !o2)
            return false;
        return o1.sid == o2.sid;
    }
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.auth.chatChannel != this.state.chatChannel) {
            this.setState({chatChannel: this.props.auth.chatChannel});
            this.changeChannel(this.props.auth.chatChannel);
        }
    }

    render() {
        let topHeight = 0;
        let topElement = document.getElementById("top-content");
        if (topElement)
            topHeight = topElement.clientHeight;

        const handleMouseDown = e => {
            document.addEventListener("mouseup", handleMouseUp, true);
            document.addEventListener("mousemove", handleMouseMove, true);
        };

        const handleMouseUp = () => {
            document.removeEventListener("mouseup", handleMouseUp, true);
            document.removeEventListener("mousemove", handleMouseMove, true);
        };

        const handleMouseMove = (e) => {
            const newWidth = e.clientX - document.body.offsetLeft;
            if (newWidth >= 0 && newWidth <= 500)
            {
                this.setDrawerWidth(newWidth);
                localStorage.setItem("chatWidth", (newWidth == 0 ? -1 : newWidth));
            }
        };

        if(!this.props.auth.user){
            return <div></div>
        }
        let containerStyle = {height:'100%'};
        if(this.state.siderWidth <5){
            containerStyle.width="10px";
        }
        return <div className="chatTab" style={containerStyle}>
            <Layout.Sider collapsible collapsed={this.state.siderWidth == 0}
                          trigger={null}
                          width={this.state.siderWidth}
                          collapsedWidth={0}
                          theme="light"
                          style={{backgroundColor: '#f8f8f8', height: "100%"}}>
                <div>
                    <Layout>
                        <Content style={{backgroundColor: "#f8f8f8", overflowY:"auto", overflowWrap:"break-word"}}>
                            <Divider>Chat: {this.state.activeChannelName}</Divider>
                            {/*<div style={{ height:"calc(100vh - "+(topHeight + 20)+"px)", overflow: "auto"}}>*/}
                                {/*<Affix>*/}
                                {/*    <Picker onSelect={this.reactTo}/>*/}
                                {/*</Affix>*/}
                                <List loading={this.state.chatLoading}
                                      dataSource={this.state.groupedMessages} size="small"

                                      renderItem={
                                          item => {
                                              let itemUID = item.author.substring(0, item.author.indexOf(":"));
                                              let isMyMessage = itemUID == this.props.auth.user.id;
                                              // let options = "";
                                              // if (isMyMessage)
                                              //     options = <Popconfirm
                                              //         title="Are you sure that you want to delete this message?"
                                              //         onConfirm={this.deleteMessage.bind(this, item)}
                                              //         okText="Yes"
                                              //         cancelText="No"
                                              //     ><Tooltip title={"Delete this message"}><a
                                              //         href="#"><CloseOutlined/></a></Tooltip></Popconfirm>
                                              let initials = "";
                                              let authorID = item.author;
                                              let addDate = this.lastDate && this.lastDate != moment(item.timestamp).day();
                                              this.lastDate = moment(item.timestamp).day();


                                              return (
                                                  <List.Item style={{padding: '0', width: "100%", textAlign: 'left'}}
                                                             key={item.sid}>
                                                      <div style={{width: "100%"}}>
                                                          {(addDate ? <Divider
                                                              style={{margin: '0'}}>{moment(item.timestamp).format("LL")}</Divider> : "")}
                                                          <Card bodyStyle={{padding: '5px', backgroundColor:"#f8f8f8"}}
                                                                style={{border: 'none', width: "100%"}}>
                                                              <Meta
                                                                  title={<div>{this.state.authors[item.author]}&nbsp;
                                                                     <span
                                                                          className="timestamp">{this.formatTime(item.timestamp)}</span>
                                                                  </div>}
                                                              />
                                                              <div>
                                                                  {item.messages.map((m) =>
                                                                      this.wrapWithOptions(m, isMyMessage)
                                                                  )}
                                                              </div>
                                                          </Card></div>
                                                  </List.Item>
                                              )
                                          }
                                      }
                                      style={{
                                          display: 'flex',
                                          flexDirection: 'column-reverse',
                                          height: 'calc(100vh - '+(topHeight+90)+"px)",
                                          overflow: 'auto',
                                          border: '1px solid #FAFAFA'
                                      }}
                                >
                                </List>
                        </Content>
                        <Footer style={{padding: "0px 0px 0px 0px", backgroundColor: "#f8f8f8", height: "40px"}}>
                            <div></div>
                            <Form onFinish={this.sendMessage}>
                                <Form.Item>
                                    <Input name={"message"} id={"message"} type="text"
                                           placeholder={"Chat in this room"}
                                           autoComplete="off"
                                           onChange={this.onMessageChanged}
                                           value={this.state.newMessage}/>
                                </Form.Item>
                            </Form>
                        </Footer>
                    </Layout>
                </div>
            </Layout.Sider>
                <div className="dragIconMiddleRight"
                     onClick={()=>{
                         localStorage.setItem("chatWidth", this.state.siderWidth == 0 ? 250 : -1);
                         console.log("Chat width local storage: " + localStorage.getItem("chatWidth"))
                         this.setState((prevState)=>({siderWidth: prevState.siderWidth == 0 ? 250 : 0}))
                     }}
                >
                    {this.state.siderWidth == 0 ? <Tooltip title="Open the chat drawer"><ChevronLeftIcon/></Tooltip>:<Tooltip title="Close the chat drawer"><ChevronRightIcon/></Tooltip>}
                    {/*<Button className="collapseButton"><ChevronLeftIcon /></Button>*/}
                </div>

                <div className="roomDraggerRight" onMouseDown={e => handleMouseDown(e)} ></div>

                {/*<div className="dragIconBottom" onMouseDown={e => handleMouseDown(e)}></div>*/}

            </div>

    }

    wrapWithOptions(m, isMyMessage, data) {
        // let options = [];
        // let _this = this;
        // options.push(<a href="#" key="react" onClick={()=>{
        //     _this.setState({
        //         reactingTo: m
        //     })
        // }}><SmileOutlined/> </a>);
        //
        // if(isMyMessage)
        //     options.push( <Popconfirm
        //         key="delete"
        //         title="Are you sure that you want to delete this message?"
        //         onConfirm={this.deleteMessage.bind(this, m)}
        //         okText="Yes"
        //         cancelText="No"
        //     ><a href="#"><CloseOutlined style={{color: "red"}}/></a></Popconfirm>)
        // return <Popover  key={m.sid} placement="topRight" content={<div style={{backgroundColor:"white"}}>
        //     {options}
        // </div>}><div ref={(el) => { this.messagesEnd = el; }} className="chatMessage"><ReactMarkdown source={m.body} renderers={{ text: emojiSupport }} /></div>
        // </Popover>
        return <div key={m.sid} className="chatMessage"><ReactMarkdown source={m.body}
                                                                       renderers={{text: emojiSupport, link:linkRenderer}}/></div>


    }

}

const AuthConsumer = (props) => (
    <AuthUserContext.Consumer>
        {value => (
            <SidebarChat {...props} auth={value}/>
        )}
    </AuthUserContext.Consumer>

);
export default AuthConsumer;