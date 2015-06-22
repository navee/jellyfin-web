﻿(function ($, document, window) {

    function reloadList(page) {

        ApiClient.getScheduledTasks({ isHidden: false }).done(function (tasks) {

            populateList(page, tasks);

            Dashboard.hideLoadingMsg();
        });
    }

    function populateList(page, tasks) {
        tasks = tasks.sort(function (a, b) {

            a = a.Category + " " + a.Name;
            b = b.Category + " " + b.Name;

            if (a == b) {
                return 0;
            }

            if (a < b) {
                return -1;
            }

            return 1;
        });

        var html = "";

        html += '<ul data-role="listview" data-inset="true" data-auto-enhanced="false" data-split-icon="action">';

        var currentCategory;

        for (var i = 0, length = tasks.length; i < length; i++) {

            var task = tasks[i];

            if (task.Category != currentCategory) {
                currentCategory = task.Category;

                html += "<li data-role='list-divider'>" + currentCategory + "</li>";
            }

            html += "<li title='" + task.Description + "'>";

            html += "<a href='scheduledtask.html?id=" + task.Id + "'>";

            html += "<h3>" + task.Name + "</h3>";

            html += "<p id='" + task.Id + "'>" + getTaskProgressHtml(task) + "</p>";

            if (task.State == "Idle") {

                html += "<a id='btnTask" + task.Id + "' class='btnStartTask' href='#' data-taskid='" + task.Id + "' data-icon='action'>" + Globalize.translate('ButtonStart') + "</a>";
            }
            else if (task.State == "Running") {

                html += "<a id='btnTask" + task.Id + "' class='btnStopTask' href='#' data-taskid='" + task.Id + "' data-icon='delete'>" + Globalize.translate('ButtonStop') + "</a>";

            } else {

                html += "<a id='btnTask" + task.Id + "' class='btnStartTask' href='#' data-taskid='" + task.Id + "' data-icon='action' style='display:none;'>" + Globalize.translate('ButtonStart') + "</a>";
            }

            html += "</a>";

            html += "</li>";
        }

        html += "</ul>";

        $('#divScheduledTasks', page).html(html).trigger('create');
    }

    function getTaskProgressHtml(task) {
        var html = '';

        if (task.State == "Idle") {

            if (task.LastExecutionResult) {

                html += Globalize.translate('LabelScheduledTaskLastRan').replace("{0}", humane_date(task.LastExecutionResult.EndTimeUtc))
                    .replace("{1}", humane_elapsed(task.LastExecutionResult.StartTimeUtc, task.LastExecutionResult.EndTimeUtc));

                if (task.LastExecutionResult.Status == "Failed") {
                    html += " <span style='color:#FF0000;'>" + Globalize.translate('LabelFailed') + "</span>";
                }
                else if (task.LastExecutionResult.Status == "Cancelled") {
                    html += " <span style='color:#0026FF;'>" + Globalize.translate('LabelCancelled') + "</span>";
                }
                else if (task.LastExecutionResult.Status == "Aborted") {
                    html += " <span style='color:#FF0000;'>" + Globalize.translate('LabelAbortedByServerShutdown') + "</span>";
                }
            }
        }
        else if (task.State == "Running") {

            var progress = (task.CurrentProgressPercentage || 0).toFixed(1);

            html += '<progress max="100" value="' + progress + '" title="' + progress + '%">';
            html += '' + progress + '%';
            html += '</progress>';

            html += "<span style='color:#009F00;margin-left:5px;'>" + progress + "%</span>";

        } else {

            html += "<span style='color:#FF0000;'>" + Globalize.translate('LabelStopping') + "</span>";
        }

        return html;
    }

    function onWebSocketMessage(e, msg) {
        if (msg.MessageType == "ScheduledTasksInfo") {

            var tasks = msg.Data;

            var page = $.mobile.activePage;

            updateTasks(page, tasks);
        }
    }

    function updateTasks(page, tasks) {
        for (var i = 0, length = tasks.length; i < length; i++) {

            var task = tasks[i];

            $('#' + task.Id, page).html(getTaskProgressHtml(task));

            var btnTask = $('#btnTask' + task.Id, page);

            updateTaskButton(btnTask, task.State);
        }
    }

    function updateTaskButton(btnTask, state) {

        var elem;

        if (state == "Idle") {

            elem = btnTask.addClass('btnStartTask').removeClass('btnStopTask').show().data("icon", "action").attr("title", Globalize.translate('ButtonStart'));

            elem.removeClass('ui-icon-delete').addClass('ui-icon-action');
        }
        else if (state == "Running") {

            elem = btnTask.addClass('btnStopTask').removeClass('btnStartTask').show().data("icon", "delete").attr("title", Globalize.translate('ButtonStop'));

            elem.removeClass('ui-icon-action').addClass('ui-icon-delete');

        } else {

            elem = btnTask.addClass('btnStartTask').removeClass('btnStopTask').hide().data("icon", "action").attr("title", Globalize.translate('ButtonStart'));

            elem.removeClass('ui-icon-stdeleteop').addClass('ui-icon-action');
        }
    }

    function onWebSocketConnectionOpen() {

        startInterval();
        reloadList($.mobile.activePage);
    }

    function startInterval() {
        if (ApiClient.isWebSocketOpen()) {
            ApiClient.sendWebSocketMessage("ScheduledTasksInfoStart", "1000,1000");
        }
    }

    function stopInterval() {
        if (ApiClient.isWebSocketOpen()) {
            ApiClient.sendWebSocketMessage("ScheduledTasksInfoStop");
        }
    }

    $(document).on('pageinitdepends', "#scheduledTasksPage", function () {

        var page = this;

        $('#divScheduledTasks', page).on('click', '.btnStartTask', function () {

            var button = this;
            var id = button.getAttribute('data-taskid');
            ApiClient.startScheduledTask(id).done(function () {

                updateTaskButton($(button), "Running");
                reloadList(page);
            });

        }).on('click', '.btnStopTask', function () {

            var button = this;
            var id = button.getAttribute('data-taskid');
            ApiClient.stopScheduledTask(id).done(function () {

                updateTaskButton($(button), "");
                reloadList(page);
            });
        });

    }).on('pageshowready', "#scheduledTasksPage", function () {

        var page = this;

        Dashboard.showLoadingMsg();

        startInterval();
        reloadList(page);

        $(ApiClient).on("websocketmessage", onWebSocketMessage).on("websocketopen", onWebSocketConnectionOpen);

    }).on('pagebeforehide', "#scheduledTasksPage", function () {

        var page = this;

        $(ApiClient).off("websocketmessage", onWebSocketMessage).off("websocketopen", onWebSocketConnectionOpen);
        stopInterval();

        $('#divScheduledTasks', page).off('click', '.btnStartTask').off('click', '.btnStopTask');
    });

})(jQuery, document, window);