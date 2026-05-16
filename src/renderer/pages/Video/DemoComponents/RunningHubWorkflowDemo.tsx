import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRunningHubTask, pollRunningHubTask } from "@/api/jikeGo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const RunningHubWorkflowDemo = () => {
    const navigate = useNavigate();
    const [workflowId, setWorkflowId] = useState("1996264470320136194");
    const [instanceType, setInstanceType] = useState("plus");
    const [nodes, setNodes] = useState([
        { nodeId: "15", fieldName: "video", fieldValue: '' },
    ]);
    const [loading, setLoading] = useState(false);
    const [taskId, setTaskId] = useState("");
    const [taskStatus, setTaskStatus] = useState("");
    const [outputs, setOutputs] = useState<any[]>([]);
    const [error, setError] = useState("");
    const addNode = () => {
        setNodes([...nodes, { nodeId: "", fieldName: "", fieldValue: '' }]);
    };
    const removeNode = (index: number) => {
        setNodes(nodes.filter((_, i) => i !== index));
    };
    const updateNode = (
        index: number,
        field: "nodeId" | "fieldName" | "fieldValue",
        value: string,
    ) => {
        const updated = [...nodes];
        updated[index][field] = value;
        setNodes(updated);
    };
    const pollTask = async (id: string) => {
        const maxAttempts = 60;
        let attempts = 0;
        const poll = async () => {
            attempts++;
            try {
                const statusResponse: any = await pollRunningHubTask({ taskId: id });
                console.log(
                    `[${new Date().toLocaleTimeString()}] 任务状态:`,
                    statusResponse,
                );
                const status =
                    statusResponse?.data?.taskStatus || statusResponse?.taskStatus || '';
                setTaskStatus(status);
                const outputList =
                    statusResponse?.data?.outputs || statusResponse?.outputs || [];
                if (status === "SUCCESS" || status === "FAILED") {
                    setOutputs(outputList);
                    console.log("任务完成，最终状态:", status, "输出:", outputList);
                    return;
                }
                if (attempts < maxAttempts) {
                    setTimeout(poll, 5000);
                } else {
                    setError("达到最大轮询次数");
                }
            } catch (err: any) {
                console.error(`轮询出错 (${attempts}):`, err);
                if (attempts < maxAttempts) {
                    setTimeout(poll, 5000);
                }
            }
        };
        await poll();
    };
    const handleSubmit = async () => {
        if (!workflowId.trim()) {
            setError("请输入 Workflow ID");
            return;
        }
        if (!nodes[0].fieldValue.trim()) {
            setError("请输入视频 URL");
            return;
        }
        setLoading(true);
        setError("");
        setTaskId("");
        setTaskStatus("");
        setOutputs([]);
        try {
            const response: any = await createRunningHubTask({
                workflowId: workflowId.trim(),
                instanceType: instanceType.trim() || "plus",
                nodeInfoList: nodes.filter((n) => n.nodeId.trim() && n.fieldValue.trim()),
            });
            const tid = response?.data?.taskId || response?.taskId;
            if (!tid) {
                setError("未获取到 taskId: " + JSON.stringify(response));
                setLoading(false);
                return;
            }
            setTaskId(tid);
            console.log("RunningHub 任务已提交，taskId:", tid);
            await pollTask(tid);
        } catch (err: any) {
            setError("提交失败: " + (err?.message || JSON.stringify(err)));
        } finally {
            setLoading(false);
        }
    };
    const videoOutput =
        outputs.find(
            (o) =>
                o.fileType?.toLowerCase().includes("mp4") ||
                o.fileType?.toLowerCase().includes("mov") ||
                o.fileType?.toLowerCase().includes("webm") ||
                /\.(mp4|mov|webm)(\?|$)/i.test(o.fileUrl || ''),
        ) || outputs[0];
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
            <div className="max-w-xl space-y-4">
                <h1 className="text-2xl font-bold mb-6">RunningHub 工作流 Demo</h1>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Workflow ID</label>
                    <Input
                        placeholder="例如: 1996264470320136194"
                        value={workflowId}
                        onChange={(e) => setWorkflowId(e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Instance Type</label>
                    <Input
                        placeholder="默认 plus"
                        value={instanceType}
                        onChange={(e) => setInstanceType(e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                    />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm text-gray-400">节点配置</label>
                        <button
                            onClick={addNode}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            + 添加节点
                        </button>
                    </div>
                    {nodes.map((node, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                            <Input
                                placeholder="Node ID"
                                value={node.nodeId}
                                onChange={(e) => updateNode(index, "nodeId", e.target.value)}
                                className="bg-white/5 border-white/10 text-white w-24"
                            />
                            <Input
                                placeholder="字段名 (video/image)"
                                value={node.fieldName}
                                onChange={(e) => updateNode(index, "fieldName", e.target.value)}
                                className="bg-white/5 border-white/10 text-white w-32"
                            />
                            <Input
                                placeholder="值 (URL 或文本)"
                                value={node.fieldValue}
                                onChange={(e) => updateNode(index, "fieldValue", e.target.value)}
                                className="bg-white/5 border-white/10 text-white flex-1"
                            />
                            {nodes.length > 1 && (
                                <button
                                    onClick={() => removeNode(index)}
                                    className="text-red-400 hover:text-red-300 text-sm"
                                >
                                    删除
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                {error && (
                    <p className="text-sm text-red-400 bg-red-900/20 p-2 rounded">{error}</p>
                )}
                <Button onClick={handleSubmit} disabled={loading} variant="blue">
                    {loading ? "处理中..." : "提交 RunningHub 任务"}
                </Button>
                {taskId && <p className="text-sm text-gray-400">当前任务ID: {taskId}</p>}
                {taskStatus && (
                    <p className="text-sm text-gray-400">
                        任务状态: <span className={taskStatus === "SUCCESS" ? "text-green-400" : taskStatus === "FAILED" ? "text-red-400" : "text-yellow-400"}>{taskStatus}</span>
                    </p>
                )}
                {videoOutput && (
                    <div className="mt-4 p-4 bg-white/5 rounded-lg">
                        <p className="text-sm text-gray-400 mb-2">生成结果:</p>
                        <a
                            href={videoOutput.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm break-all block mb-2"
                        >
                            {videoOutput.fileUrl}
                        </a>
                        <div className="text-xs text-gray-500 mb-2">
                            类型: {videoOutput.fileType} | 节点: {videoOutput.nodeId} | 耗时: {videoOutput.taskCostTime}
                        </div>
                        {/\.(mp4|mov|webm)(\?|$)/i.test(videoOutput.fileUrl || "") && (
                            <video
                                src={videoOutput.fileUrl}
                                controls
                                className="mt-3 w-full max-w-lg rounded-lg"
                            />
                        )}
                    </div>
                )}
                <div className="text-xs text-gray-500 mt-4">
                    <p>操作说明：</p>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>输入 Workflow ID（默认使用视频超分工作流）</li>
                        <li>配置节点信息：Node ID、字段名、值（支持视频/图片 URL）</li>
                        <li>点击提交后会自动创建 RunningHub 任务</li>
                        <li>每5秒轮询一次任务状态，完成后显示输出文件</li>
                        <li>RunningHub API Key 已硬编码在后端，前端无需传入</li>
                    </ol>
                </div>
                <div className="pt-6 border-t border-white/10">
                    <Button onClick={() => navigate("/video")} variant="blue">
                        返回短片合成
                    </Button>
                </div>
            </div>
        </div>
    );
};
export default RunningHubWorkflowDemo;
