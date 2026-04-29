-- AI 视频生成埋点记录表
-- 创建时间: 2026-04-28

CREATE TABLE IF NOT EXISTS `ai_video_track_logs` (
  `id` BIGINT NOT NULL COMMENT '主键，雪花ID',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户标识',
  `user_uuid` VARCHAR(64) DEFAULT NULL COMMENT '用户UUID',
  `api_name` VARCHAR(256) NOT NULL COMMENT 'API名称',
  `model` VARCHAR(128) NOT NULL COMMENT '模型名称',
  `model_version` VARCHAR(64) DEFAULT NULL COMMENT '模型版本',
  `task_id` VARCHAR(128) NOT NULL COMMENT '任务ID',
  `prompt` TEXT DEFAULT NULL COMMENT '视频描述提示词',
  `duration` INT DEFAULT NULL COMMENT '视频时长（秒）',
  `reference_image_url` TEXT DEFAULT NULL COMMENT '用户提供的参考图URL',
  `provider` VARCHAR(64) DEFAULT NULL COMMENT '服务提供商',
  `request_params` TEXT DEFAULT NULL COMMENT '请求参数JSON',
  `response_task_id` VARCHAR(128) DEFAULT NULL COMMENT '响应返回的task_id',
  `generated_video_url` TEXT DEFAULT NULL COMMENT '生成的视频URL',
  `status` VARCHAR(32) NOT NULL COMMENT '状态：SUCCESS/FAIL/PENDING',
  `error_message` TEXT DEFAULT NULL COMMENT '错误信息',
  `create_time` BIGINT NOT NULL COMMENT '创建时间（毫秒时间戳）',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_create_time` (`create_time`),
  INDEX `idx_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI视频生成埋点记录表';
