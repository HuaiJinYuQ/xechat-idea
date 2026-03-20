package cn.xeblog.plugin.chat.adapter;

import cn.xeblog.commons.enums.Platform;
import cn.xeblog.plugin.util.IdeaUtils;

public class JetBrainsIDEChatAdapter implements IDEChatAdapter {

    @Override
    public Platform getPlatform() {
        return Platform.IDEA;
    }

    @Override
    public String getPluginVersion() {
        return IdeaUtils.getPluginVersion();
    }
}
