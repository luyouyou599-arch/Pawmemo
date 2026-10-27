import XCTest

final class ShellUITests: XCTestCase {
    func testFormSafeAreaAfterKeyboardAndDatePicker() {
        let app = XCUIApplication()
        app.launchArguments = ["-PawMemoUITestEphemeral"]
        app.launch()
        let create = app.buttons["建立宠物档案"]
        XCTAssertTrue(create.waitForExistence(timeout: 20)); create.tap()
        let name = app.webViews.textFields.firstMatch
        XCTAssertTrue(name.waitForExistence(timeout: 8)); name.tap(); name.typeText("Safe Pet")
        let done = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "Done", "完成")).firstMatch
        if done.waitForExistence(timeout: 2) { done.tap() }
        let birthday = app.staticTexts["生日（选填）"]
        XCTAssertTrue(birthday.exists); birthday.tap()
        let firstDay = app.buttons.matching(NSPredicate(format: "label MATCHES %@", ".*月1日 .*")).firstMatch
        XCTAssertTrue(firstDay.waitForExistence(timeout: 3)); firstDay.tap()
        let dateDone = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "Done", "完成")).firstMatch
        if dateDone.waitForExistence(timeout: 2) { dateDone.tap() }
        else { app.staticTexts["名字和类型必填，其他资料可稍后补充。"].tap() }
        let save = app.buttons["创建档案"]
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        let web = app.webViews.firstMatch
        print("SAFE_UI form app=\(app.frame) web=\(web.frame) button=\(save.frame)")
        XCTAssertGreaterThanOrEqual(save.frame.minY, web.frame.minY)
        XCTAssertLessThanOrEqual(save.frame.maxY, web.frame.maxY - 12)
        XCTAssertLessThanOrEqual(web.frame.maxY, app.frame.maxY - 34)
        XCTAssertGreaterThanOrEqual(web.frame.minY, 62)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Form after keyboard dismissal and birthday selection"; shot.lifetime = .keepAlways; add(shot)
    }
    func testNativeLaunchKeyboardAndPhotoChooserCancel() {
        let app = XCUIApplication()
        app.launchArguments = ["-PawMemoUITestEphemeral"]
        app.launch()
        let create = app.buttons.matching(NSPredicate(format: "label == %@", "建立宠物档案")).firstMatch
        XCTAssertTrue(create.waitForExistence(timeout: 20)); create.tap()
        let name = app.webViews.textFields.firstMatch
        XCTAssertTrue(name.waitForExistence(timeout: 8)); name.tap(); name.typeText("Shell Pet")
        let photo = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "添加宠物照片")).firstMatch
        XCTAssertTrue(photo.exists); photo.tap()
        print("SHELL_PHOTO_MENU_BEGIN\n" + app.debugDescription + "\nSHELL_PHOTO_MENU_END")
        let tree = XCTAttachment(string: app.debugDescription); tree.name = "Native photo chooser tree"; tree.lifetime = .keepAlways; add(tree)
        let cancel = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "取消", "Cancel")).firstMatch
        if cancel.waitForExistence(timeout: 2) { cancel.tap() }
        else {
            let menuItem = app.buttons.matching(NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@ OR label CONTAINS %@", "文件", "File", "照片图库")).firstMatch
            XCTAssertTrue(menuItem.waitForExistence(timeout: 3))
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.7)).tap()
        }
        XCTAssertEqual(name.value as? String, "Shell Pet")
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Independent iOS shell form"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
}
