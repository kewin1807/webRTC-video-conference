import React from 'react';
import { Form, Input, Button } from "antd"
import "./Home.css"

const layout = {
	labelCol: { span: 8 },
	wrapperCol: { span: 16 },
};

const validateMessages = {
	required: '${label} is required!',
};
const Home = (props) => {
	// console.log(props);
	const onFinish = (values) => {
		if (values && values.room) {
			if (values.room.roomname !== "") {
				const url = values.room.roomname.split("/")
				if (props && props.history) {
					props.history.push({
						pathname: `/${url[url.length - 1]}`,
						state: { username: values.room.username, password: values.room.password }
					})
				}
			}
			else {
				var url = Math.random().toString(36).substring(2, 7)
				if (props && props.history) {
					props.history.push({
						pathname: `/${url[url.length - 1]}`,
						state: { username: values.room.username, password: values.room.password }
					})
				}
			}
		}
	}
	return (
		<div style={{ justifyContent: 'center', alignItems: 'center', margin: 20 }}>
			<h1 style={{ fontSize: "45px" }}>Video Meeting</h1>
			<p style={{ fontWeight: "200" }}>Video conference website that lets you stay in touch with all your friends.</p>

			<div style={{ paddingTop: 100, paddingRight: 200 }}>
				<Form {...layout} name="nest-messages" onFinish={onFinish} validateMessages={validateMessages}>
					<Form.Item name={['room', 'username']} label="Username" rules={[{ required: true }]}>
						<Input />
					</Form.Item>
					<Form.Item name={['room', 'roomname']} label="Room name" rules={[{ required: true }]}>
						<Input />
					</Form.Item>
					<Form.Item name={['room', 'password']} label="Password Room" rules={[{ required: true }]}>
						<Input.Password />
					</Form.Item>
					<Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 8 }}>
						<Button type="primary" htmlType="submit">
							Create Room
			</Button>
					</Form.Item>
				</Form>
			</div>

		</div>

	);
}

export default Home;