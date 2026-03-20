package cn.xeblog.plugin.chat.adapter;

import cn.xeblog.commons.enums.Platform;

public interface IDEChatAdapter {

    Platform getPlatform();

    String getPluginVersion();
}
