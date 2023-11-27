export class AnalyticsLogger {
    /**
     * Constructs an event logger using Google Analytics. It assumes there is a
     * Google Analytics script added to the page elsewhere. If there is no such
     * script, the logger acts as a no-op.
     *
     * @param pageViewLogging Whether to log page views.
     * @param eventLogging Whether to log user interaction.
     */
    constructor(pageViewLogging, eventLogging) {
        if (typeof ga === 'undefined' || ga == null) {
            this.eventLogging = false;
            this.pageViewLogging = false;
            return;
        }
        this.eventLogging = eventLogging;
        this.pageViewLogging = pageViewLogging;
    }
    logPageView(pageTitle) {
        if (this.pageViewLogging) {
            // Always send a page view.
            ga('send', { hitType: 'pageview', page: `/v/${pageTitle}` });
        }
    }
    logProjectionChanged(projection) {
        if (this.eventLogging) {
            ga('send', {
                hitType: 'event',
                eventCategory: 'Projection',
                eventAction: 'click',
                eventLabel: projection,
            });
        }
    }
    logWebGLDisabled() {
        if (this.eventLogging) {
            ga('send', {
                hitType: 'event',
                eventCategory: 'Error',
                eventAction: 'PageLoad',
                eventLabel: 'WebGL_disabled',
            });
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5hbHl0aWNzTG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vdGVuc29yYm9hcmQvcHJvamVjdG9yL2FuYWx5dGljc0xvZ2dlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFnQkEsTUFBTSxPQUFPLGVBQWU7SUFHMUI7Ozs7Ozs7T0FPRztJQUNILFlBQVksZUFBd0IsRUFBRSxZQUFxQjtRQUN6RCxJQUFJLE9BQU8sRUFBRSxLQUFLLFdBQVcsSUFBSSxFQUFFLElBQUksSUFBSSxFQUFFO1lBQzNDLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDO1lBQzFCLElBQUksQ0FBQyxlQUFlLEdBQUcsS0FBSyxDQUFDO1lBQzdCLE9BQU87U0FDUjtRQUNELElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO0lBQ3pDLENBQUM7SUFDRCxXQUFXLENBQUMsU0FBaUI7UUFDM0IsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFO1lBQ3hCLDJCQUEyQjtZQUMzQixFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsTUFBTSxTQUFTLEVBQUUsRUFBQyxDQUFDLENBQUM7U0FDNUQ7SUFDSCxDQUFDO0lBQ0Qsb0JBQW9CLENBQUMsVUFBMEI7UUFDN0MsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3JCLEVBQUUsQ0FBQyxNQUFNLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLE9BQU87Z0JBQ2hCLGFBQWEsRUFBRSxZQUFZO2dCQUMzQixXQUFXLEVBQUUsT0FBTztnQkFDcEIsVUFBVSxFQUFFLFVBQVU7YUFDdkIsQ0FBQyxDQUFDO1NBQ0o7SUFDSCxDQUFDO0lBQ0QsZ0JBQWdCO1FBQ2QsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3JCLEVBQUUsQ0FBQyxNQUFNLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLE9BQU87Z0JBQ2hCLGFBQWEsRUFBRSxPQUFPO2dCQUN0QixXQUFXLEVBQUUsVUFBVTtnQkFDdkIsVUFBVSxFQUFFLGdCQUFnQjthQUM3QixDQUFDLENBQUM7U0FDSjtJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qIENvcHlyaWdodCAyMDE2IFRoZSBUZW5zb3JGbG93IEF1dGhvcnMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cbmltcG9ydCB7UHJvamVjdGlvblR5cGV9IGZyb20gJy4vZGF0YSc7XG5cbmV4cG9ydCBjbGFzcyBBbmFseXRpY3NMb2dnZXIge1xuICBwcml2YXRlIGV2ZW50TG9nZ2luZzogYm9vbGVhbjtcbiAgcHJpdmF0ZSBwYWdlVmlld0xvZ2dpbmc6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RzIGFuIGV2ZW50IGxvZ2dlciB1c2luZyBHb29nbGUgQW5hbHl0aWNzLiBJdCBhc3N1bWVzIHRoZXJlIGlzIGFcbiAgICogR29vZ2xlIEFuYWx5dGljcyBzY3JpcHQgYWRkZWQgdG8gdGhlIHBhZ2UgZWxzZXdoZXJlLiBJZiB0aGVyZSBpcyBubyBzdWNoXG4gICAqIHNjcmlwdCwgdGhlIGxvZ2dlciBhY3RzIGFzIGEgbm8tb3AuXG4gICAqXG4gICAqIEBwYXJhbSBwYWdlVmlld0xvZ2dpbmcgV2hldGhlciB0byBsb2cgcGFnZSB2aWV3cy5cbiAgICogQHBhcmFtIGV2ZW50TG9nZ2luZyBXaGV0aGVyIHRvIGxvZyB1c2VyIGludGVyYWN0aW9uLlxuICAgKi9cbiAgY29uc3RydWN0b3IocGFnZVZpZXdMb2dnaW5nOiBib29sZWFuLCBldmVudExvZ2dpbmc6IGJvb2xlYW4pIHtcbiAgICBpZiAodHlwZW9mIGdhID09PSAndW5kZWZpbmVkJyB8fCBnYSA9PSBudWxsKSB7XG4gICAgICB0aGlzLmV2ZW50TG9nZ2luZyA9IGZhbHNlO1xuICAgICAgdGhpcy5wYWdlVmlld0xvZ2dpbmcgPSBmYWxzZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5ldmVudExvZ2dpbmcgPSBldmVudExvZ2dpbmc7XG4gICAgdGhpcy5wYWdlVmlld0xvZ2dpbmcgPSBwYWdlVmlld0xvZ2dpbmc7XG4gIH1cbiAgbG9nUGFnZVZpZXcocGFnZVRpdGxlOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5wYWdlVmlld0xvZ2dpbmcpIHtcbiAgICAgIC8vIEFsd2F5cyBzZW5kIGEgcGFnZSB2aWV3LlxuICAgICAgZ2EoJ3NlbmQnLCB7aGl0VHlwZTogJ3BhZ2V2aWV3JywgcGFnZTogYC92LyR7cGFnZVRpdGxlfWB9KTtcbiAgICB9XG4gIH1cbiAgbG9nUHJvamVjdGlvbkNoYW5nZWQocHJvamVjdGlvbjogUHJvamVjdGlvblR5cGUpIHtcbiAgICBpZiAodGhpcy5ldmVudExvZ2dpbmcpIHtcbiAgICAgIGdhKCdzZW5kJywge1xuICAgICAgICBoaXRUeXBlOiAnZXZlbnQnLFxuICAgICAgICBldmVudENhdGVnb3J5OiAnUHJvamVjdGlvbicsXG4gICAgICAgIGV2ZW50QWN0aW9uOiAnY2xpY2snLFxuICAgICAgICBldmVudExhYmVsOiBwcm9qZWN0aW9uLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGxvZ1dlYkdMRGlzYWJsZWQoKSB7XG4gICAgaWYgKHRoaXMuZXZlbnRMb2dnaW5nKSB7XG4gICAgICBnYSgnc2VuZCcsIHtcbiAgICAgICAgaGl0VHlwZTogJ2V2ZW50JyxcbiAgICAgICAgZXZlbnRDYXRlZ29yeTogJ0Vycm9yJyxcbiAgICAgICAgZXZlbnRBY3Rpb246ICdQYWdlTG9hZCcsXG4gICAgICAgIGV2ZW50TGFiZWw6ICdXZWJHTF9kaXNhYmxlZCcsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==