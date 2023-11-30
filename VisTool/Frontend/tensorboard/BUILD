# Description:
# TensorBoard, a dashboard for investigating TensorFlow

load("//tensorboard/defs:web.bzl", "tf_web_library")

package(default_visibility = [":internal"])

licenses(["notice"])

exports_files(["LICENSE"])  # Needed for internal repo.

package_group(
    name = "internal",
    packages = ["//tensorboard/..."],
)


# The dependencies needed to initialize the `tensorboard` module itself,
# which are not sufficient to resolve all of its lazy imports. Use only
# if you're intending to link in a proper subset of TensorBoard's public
# API, you're linking in that subset explicitly in your downstream
# target, and you know what you're doing.



tf_web_library(
    name = "assets",
    srcs = [
        "//tensorboard/webapp:index.html",
        "//tensorboard/webapp:index.js",
        "//tensorboard/webapp:svg_bundle",
    ],
    path = "/",
    deps = [
        "//tensorboard/plugins/debugger_v2/tf_debugger_v2_plugin/views/source_code/monaco:monaco_editor",
        "//tensorboard/plugins/debugger_v2/tf_debugger_v2_plugin/views/source_code/monaco:monaco_languages",
        "@com_google_fonts_roboto",
    ],
)



