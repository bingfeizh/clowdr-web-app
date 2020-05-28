import React, {Fragment} from 'react';
import {Button, DatePicker, Form, Input, Select, Modal, Popconfirm, Space, Spin, Table, Tabs} from "antd";
import Parse from "parse";
import ParseLiveContext from "../../parse/context";

const { Option } = Select;

const {TabPane} = Tabs;
const IconText = ({icon, text}) => (
    <Space>
        {React.createElement(icon)}
        {text}
    </Space>
);

const LiveVideoSources = ['', 'YouTube', 'Twitch', 'Facebook'];

class LiveVideos extends React.Component {
    constructor(props) {
        super(props);
        console.log(this.props);
        this.state = {
            loading: false, 
            videos: [],
            src1: undefined,
            src2: undefined,
            editing: false,
            edt_video: undefined
        };
    }

    onCreate(values) {
        var _this = this;
        var Video = Parse.Object.extend("LiveVideo");
        var video = new Video();
        video.set("title", values.title);
        video.set("src1", values.src1);
        video.set("id1", values.id1);
        video.set("src2", values.src2);
        video.set("id2", values.id2);
        video.save().then((val) => {
            _this.setState({visible: false})
            _this.refreshList();
        }).catch(err => {
            console.log(err);
        });
    }

    onDelete(value) {
        console.log("Deleting " + value + " " + value.id1);
        value.destroy().then(()=>{
            this.refreshList();
        });
        // this.videoRef.child(key).remove();
    }

    onEdit(video) {
        console.log("Editing " + JSON.stringify(video) + " " + video.get("id1") + " " + video.id);
        this.setState({
            visible: true, 
            editing: true, 
            edt_video: {
                objectId: video.id,
                title: video.get("title"),
                src1: video.get("src1"),
                id1: video.get("id1"),
                src2: video.get("src2"),
                id2: video.get("id2"),
            }
        });
    }

    onUpdate(values) {
        var _this = this;
        console.log("Updating " + values.id1 + "; " + values.objectId);
        let query = new Parse.Query("LiveVideo");
        query.get(values.objectId).then(video => {
            if (video) {
                video.set("title", values.title);
                video.set("src1", values.src1);
                video.set("id1", values.id1);
                video.set("src2", values.src2);
                video.set("id2", values.id2);
                video.save().then((val) => {
                    _this.setState({visible: false, editing: false});
                    _this.refreshList();
                }).catch(err => {
                    console.log(err + ": " + values.objectId);
                })
            }
            else {
                console.log("Video not found: " + values.id1);
            }
        });
    }

    setVisible() {
        this.setState({'visible': !this.state.visible});
    }

    componentDidMount() {
        this.refreshList();
        // this.sub = this.props.parseLive.subscribe(query);
        // this.sub.on('create', vid=>{
        //     console.log(vid);
        // })
    }

    refreshList(){
        let query = new Parse.Query("LiveVideo");
        query.find().then(res=>{
            this.setState({
                videos: res,
                loading: false
            })
        })
    }
    componentWillUnmount() {
        // this.sub.unsubscribe();
    }

    render() {
        const columns = [
            {
                title: 'Title',
                dataIndex: 'title',
                key: 'title',
                render: (text, record) => <span>{record.get("title")}</span>,
            },
            {
                title: 'Main Video Source',
                dataIndex: 'src1',
                render: (text,record) => <span>{record.get("src1")}</span>,
                key: 'videosrc1',
            },
            {
                title: 'Video ID',
                dataIndex: 'id1',
                render: (text,record) => <span>{record.get("id1")}</span>,
                key: 'videoid1',
            },
            {
                title: 'Alt Video Source',
                dataIndex: 'src2',
                render: (text,record) => <span>{record.get("src2")}</span>,
                key: 'videosrc2',
            },
            {
                title: 'Alt Video ID',
                dataIndex: 'id2',
                render: (text,record) => <span>{record.get("id2")}</span>,
                key: 'videoid2',
            },
            // {
            //     title: 'Address',
            //     dataIndex: 'address',
            //     key: 'address',
            // },
            {
                title: 'Action',
                key: 'action',
                render: (text, record) => (
                    <Space size="small">
                        <a href="#" video={record} onClick={() => this.onEdit(record)}>Edit</a>
                        <Popconfirm
                            title="Are you sure delete this video?"
                            onConfirm={()=>this.onDelete(record)}
                            okText="Yes"
                            cancelText="No"
                        >
                        <a href="#">Delete</a>
                        </Popconfirm>
                    </Space>
                ),
            },
        ];

        if (this.state.loading)
            return (
                <Spin tip="Loading...">
                </Spin>)

        else if (this.state.editing)
            return (
                <Fragment>
                    <CollectionEditForm
                        title="Edit live video link"
                        visible={this.state.visible}
                        data={this.state.edt_video}
                        onAction={this.onUpdate.bind(this)}
                        onCancel={() => {
                            this.setVisible(false);
                        }}
                        onSelectPullDown1={(value) => {
                            this.setState({src1: value});
                        }}
                        onSelectPullDown2={(value) => {
                            this.setState({src2: value});
                        }}
                    />
                <Table columns={columns} dataSource={this.state.videos} rowKey={(v)=>(v.id1)}>
                </Table>
            </Fragment>
            )
        return <div>
            <Button
                type="primary"
                onClick={() => {
                    this.setVisible(true);
                }}
            >
                New Video
            </Button>
            <CollectionEditForm
                title="Add a live video link"
                visible={this.state.visible}
                onAction={this.onCreate.bind(this)}
                onCancel={() => {
                    this.setVisible(false);
                }}
                onSelectPullDown1={(value) => {
                    this.setState({src1: value});
                }}
                onSelectPullDown2={(value) => {
                    this.setState({src2: value});
                }}
            />
            <Table columns={columns} dataSource={this.state.videos} rowKey={(v)=>(v.id1)}>
            </Table>
        </div>
    }

}

const ParseLiveConsuemr = (props) => (
    <ParseLiveContext.Consumer>
        {value => (
            <LiveVideos {...props} parseLive={value}/>
        )}
    </ParseLiveContext.Consumer>
)
export default ParseLiveConsuemr;

const CollectionEditForm = ({title, visible, data, onAction, onCancel, onSelectPullDown1, onSelectPullDown2}) => {
    const [form] = Form.useForm();
    return (
        <Modal
            visible={visible}
            title={title}
            // okText="Create"
            footer={[
                <Button form="myForm" key="submit" type="primary" htmlType="submit">
                    Submit
                </Button>
            ]}
            cancelText="Cancel"
            onCancel={onCancel}
        >
            <Form
                form={form}
                layout="vertical"
                name="form_in_modal"
                id="myForm"
                initialValues={{
                    modifier: 'public',
                    ...data
                }}
                onFinish={() => {
                    form
                        .validateFields()
                        .then(values => {
                            form.resetFields();
                            onAction(values);
                        })
                        .catch(info => {
                            console.log('Validate Failed:', info);
                        });
                }}
            >
                <Form.Item
                    name="title"
                    label="Title"
                    rules={[
                        {
                            required: true,
                            message: 'Please input the title of the live video!',
                        },
                    ]}
                >
                    <Input/>
                </Form.Item>
                <Form.Item name="src1" label="Main live video source" rules={[
                    {
                        required: true,
                        message: 'Please input the source of this live video'
                    },
                ]}>
                    <Select onChange={onSelectPullDown1}>
                        {LiveVideoSources.map(src => (
                            <Option key={src}>{src}</Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="id1" label="Video ID in main source" rules={[
                    {
                        required: true,
                        message: 'Please input the ID of this live video'
                    },
                ]}>
                    <Input type="textarea"/>
                </Form.Item>
                <Form.Item name="src2" label="Alternate source">
                    <Select onChange={onSelectPullDown2}>
                        {LiveVideoSources.map(src => (
                            <Option key={src}>{src}</Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="id2" label="Video ID in alternate source" rules={[
                    {
                        required: false
                    },
                ]}>
                    <Input type="textarea"/>
                </Form.Item>
                <Form.Item name="startTime" label="Publish at">
                    <DatePicker showTime/>
                </Form.Item>
                <Form.Item name="startTime" label="Remove from page at">
                    <DatePicker showTime/>
                </Form.Item>
                <Form.Item name="objectId">
                    <Input type="hidden" />
                </Form.Item>
            </Form>
        </Modal>
    );
};