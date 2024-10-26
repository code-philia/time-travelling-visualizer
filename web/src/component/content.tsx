import './index.css'

export function ContentContainer() {
    return (
        <div className="content_container">
            <div id="container_range">
                <div id="container">
                </div>
            </div>
            <div id="footer">
                <div>Epochs</div>
                <svg id="timeLinesvg" height="0" width="0"></svg>
            </div>
        </div>
    )
}