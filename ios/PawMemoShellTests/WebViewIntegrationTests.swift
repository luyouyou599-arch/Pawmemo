import XCTest
import WebKit
import SwiftUI
@testable import PawMemoShell

@MainActor
final class WebViewIntegrationTests: XCTestCase {
    private var window: UIWindow!
    private var session: WebSession!

    override func setUp() async throws {
        session = WebSession(dataStore: .nonPersistent())
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        window = UIWindow(windowScene: scene)
        let controller = UIHostingController(rootView: ZStack {
            Color.white.ignoresSafeArea()
            WebSurface(session: session)
        })
        window.rootViewController = controller
        window.makeKeyAndVisible()
        session.reconnect()
        try await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent==='建立宠物档案')")
    }
    override func tearDown() async throws {
        session.webView.stopLoading(); window.isHidden = true; window = nil; session = nil
    }
    private func js(_ source: String) async throws -> Any {
        try await session.webView.evaluateJavaScript(source)
    }
    private func waitFor(_ expression: String) async throws {
        for _ in 0..<150 {
            if let ready = try? await js(expression) as? Bool, ready { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let diagnostic = try? await js("JSON.stringify({phase:document.querySelector('.home-hold-record')?.dataset.phase,contextState:window.audioFixtureContext?.state,error:document.querySelector('[role=alert]')?.textContent,mime:window.nativeRecorderMime,evidence:window.nativeAudioEvidence})")
        print("WEB_CONDITION_FAILURE " + String(describing: diagnostic))
        XCTFail("Web content condition did not complete")
        throw URLError(.timedOut)
    }
    func testActualWKWebViewLocksSecureContextAndBoundedLocalStorage() async throws {
        let result = try await js("""
        JSON.stringify({secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
        mediaDevices:typeof navigator.mediaDevices?.getUserMedia==='function',
        recorder:typeof MediaRecorder==='function',pcm:typeof OfflineAudioContext==='function'})
        """) as? String
        let data = try XCTUnwrap(result?.data(using: .utf8))
        let caps = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Bool])
        XCTAssertTrue(caps["secure"] == true); XCTAssertTrue(caps["locks"] == true)
        XCTAssertTrue(caps["mediaDevices"] == true); XCTAssertTrue(caps["recorder"] == true)
        XCTAssertTrue(caps["pcm"] == true)
        let attachment = XCTAttachment(string: result ?? ""); attachment.name = "WKWebView capabilities"; attachment.lifetime = .keepAlways; add(attachment)
        _ = try await js("window.shellLockDone=false;navigator.locks.request('shell-capability-test',()=>{localStorage.setItem('shell-test-key','ok');window.shellStorageOK=localStorage.getItem('shell-test-key')==='ok';localStorage.removeItem('shell-test-key');window.shellLockDone=true});true")
        try await waitFor("window.shellLockDone===true && window.shellStorageOK===true")
    }
    func testCurrentFrontendCreateInputAndSyntheticPhotoAdoptWithoutAI() async throws {
        _ = try await js("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('建立宠物档案')).click();true")
        try await waitFor("document.querySelector('input[name=name]')!==null")
        _ = try await js("""
        (()=>{const name=document.querySelector('input[name=name]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(name,'Shell Test');
        name.dispatchEvent(new Event('input',{bubbles:true}));
        const kind=document.querySelector('select[name=kind]');kind.value='猫';kind.dispatchEvent(new Event('change',{bubbles:true}));
        const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
        const ctx=canvas.getContext('2d');ctx.fillStyle='#d7ff22';ctx.fillRect(0,0,32,32);
        canvas.toBlob(blob=>{const input=document.querySelector('input[type=file]'),dt=new DataTransfer();
        dt.items.add(new File([blob],'synthetic.png',{type:''}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));},'image/png');})();true
        """)
        try await waitFor("document.querySelector('.photo-holder .avatar img')!==null")
        try await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent==='创建档案' && !b.disabled)")
        _ = try await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='创建档案').click();true")
        try await waitFor("document.querySelector('.screen-home')!==null")
        let savedName = try await js("document.querySelector('.pet-information h1').textContent") as? String
        XCTAssertEqual(savedName, "Shell Test")
        let attachment = XCTAttachment(image: try await session.webView.takeSnapshot(configuration: nil))
        attachment.name = "Actual WKWebView created profile returns home"; attachment.lifetime = .keepAlways; add(attachment)
    }
    func testSafeAreaContainsFormHomeAndComposer() async throws {
        func check(_ screen: String) async throws {
            let result = try await js("""
            JSON.stringify((()=>{const shell=document.querySelector('.app-shell').getBoundingClientRect(),
            header=document.querySelector('header').getBoundingClientRect(),
            footer=document.querySelector('footer,.composer').getBoundingClientRect();
            return {screen:'\(screen)',innerHeight,viewportHeight:visualViewport.height,shellTop:shell.top,
            shellBottom:shell.bottom,headerTop:header.top,footerBottom:footer.bottom};})())
            """) as! String
            print("SAFE_AREA_METRICS " + result + " nativeHeight=\(session.webView.bounds.height) nativeFrame=\(session.webView.frame) safeInsets=\(window.safeAreaInsets)")
            let metrics = try JSONSerialization.jsonObject(with: Data(result.utf8)) as! [String: Any]
            let nativeHeight = session.webView.bounds.height
            XCTAssertLessThanOrEqual((metrics["shellBottom"] as! Double), nativeHeight + 1)
            XCTAssertGreaterThanOrEqual((metrics["headerTop"] as! Double), 0)
            XCTAssertLessThanOrEqual((metrics["footerBottom"] as! Double), nativeHeight + 1)
            let shot = XCTAttachment(image: try await session.webView.takeSnapshot(configuration: nil))
            shot.name = "Safe area " + screen; shot.lifetime = .keepAlways; add(shot)
        }
        _ = try await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='建立宠物档案').click();true")
        try await waitFor("document.querySelector('[name=birthday]')!==null")
        try await check("create")
        _ = try await js("""
        (()=>{for(const [key,value] of Object.entries({name:'Safe Test',birthday:'2026-10-01'})){
        const input=document.querySelector('[name='+key+']');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
        input.dispatchEvent(new Event('input',{bubbles:true}));}
        const kind=document.querySelector('[name=kind]');kind.value='猫';kind.dispatchEvent(new Event('change',{bubbles:true}));})();true
        """)
        let dateAlignment = try await js("getComputedStyle(document.querySelector('[name=birthday]')).textAlign") as? String
        XCTAssertEqual(dateAlignment, "left")
        try await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent==='创建档案' && !b.disabled)")
        _ = try await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='创建档案').click();true")
        try await waitFor("document.querySelector('.screen-home')!==null")
        try await check("home")
        _ = try await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='进入对话').click();true")
        try await waitFor("document.querySelector('.composer')!==null")
        try await check("chat")
    }

    func testPartialExtractionReplayAndSwitchAlignmentInWKWebView() async throws {
        // Initial extraction replays an accepted real model result; follow-up is a synthetic fixture.
        // Verifies native app state and UI, not new model semantics; zero external calls.
        _ = try await js(#"""
        (()=>{
          window.partialFixture={"name":"two-known-events-and-unclear-event","input":"咪咪今天在窗台晒太阳。它吃了兔肉粮，很喜欢。后来它和奶酪那样了，我没看清。","result":{"intent":"record","facts":[{"content":"咪咪今天在窗台晒太阳。","tags":["行为","日光浴"],"quote":"咪咪今天在窗台晒太阳。","eventAt":null},{"content":"咪咪吃了兔肉粮，且很喜欢吃。","tags":["饮食","偏好"],"quote":"它吃了兔肉粮，很喜欢。","eventAt":null}],"question":"","clarification":"后来咪咪和奶酪发生了什么？"},"status":"passed"};
          window.partialRequests=[];
          window.fetch=async(url,options)=>{
            if(String(url)!=='/api/extract')throw Error('External requests forbidden in native replay');
            const v=JSON.parse(options.body);window.partialRequests.push(v);
            const first=v.text===window.partialFixture.input;
            if(!first&&v.text!=='后来咪咪躲到了床底。')throw Error('Unexpected synthetic input');
            const result=first?window.partialFixture.result:{intent:'record',facts:[{content:v.text,quote:v.text,tags:['行为'],eventAt:null}],question:'',clarification:''};
            return new Response(JSON.stringify({petId:v.petId,messageId:v.messageId,requestId:v.requestId,result}),{status:200,headers:{'Content-Type':'application/json'}});
          };
          window.fixtureCreate=name=>{
            const input=document.querySelector('[name=name]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,name);input.dispatchEvent(new Event('input',{bubbles:true}));
            const kind=document.querySelector('[name=kind]');kind.value='猫';kind.dispatchEvent(new Event('change',{bubbles:true}));
          };
          window.fixtureSend=text=>{
            const input=document.querySelector('.composer textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));
          };
          [...document.querySelectorAll('button')].find(b=>b.textContent==='建立宠物档案').click();
        })();true
        """#)
        try await waitFor("document.querySelector('[name=name]')!==null")
        _ = try await js("window.fixtureCreate('咪咪');true")
        try await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent==='创建档案'&&!b.disabled)")
        _ = try await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='创建档案').click();true")
        try await waitFor("document.querySelector('.pet-pill')!==null")
        let pillAligned = try await js("(()=>{const p=document.querySelector('.pet-pill').getBoundingClientRect();return [...document.querySelectorAll('.pet-pill>.avatar,.pet-pill>.v3-icon,.pet-pill>.pet-name')].every(e=>{const r=e.getBoundingClientRect();return Math.abs(r.y+r.height/2-p.y-p.height/2)<1})})()") as? Bool
        XCTAssertEqual(pillAligned, true)
        _ = try await js("document.querySelector('.pet-pill').click();true")
        try await waitFor("document.querySelector('.screen-switch')!==null")
        _ = try await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='添加另一只宠物').click();true")
        try await waitFor("document.querySelector('[name=name]')!==null")
        _ = try await js("window.fixtureCreate('奶酪');true")
        try await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent==='创建档案'&&!b.disabled)")
        _ = try await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='创建档案').click();true")
        try await waitFor("document.querySelector('.pet-pill')!==null")
        _ = try await js("document.querySelector('.pet-pill').click();true")
        try await waitFor("document.querySelectorAll('.pet-row').length===2")
        let iconAligned = try await js("(()=>{const row=document.querySelector('.pet-row:not(.selected)'),icon=row.querySelector(':scope>.v3-icon'),r=row.getBoundingClientRect(),i=icon.getBoundingClientRect(),c=document.querySelector('.pet-row.selected>b').getBoundingClientRect();return Math.abs(r.y+r.height/2-i.y-i.height/2)<1&&Math.abs(i.right-c.right)<1&&r.right-i.right<14&&icon.querySelector('img').getAttribute('src')==='/v3/switch-pets.svg'})()") as? Bool
        let iconMetrics = try await js("JSON.stringify((()=>{const row=document.querySelector('.pet-row:not(.selected)'),icon=row.querySelector(':scope>.v3-icon'),r=row.getBoundingClientRect(),i=icon.getBoundingClientRect(),c=document.querySelector('.pet-row.selected>b').getBoundingClientRect();return {row:r.toJSON(),icon:i.toJSON(),current:c.toJSON(),src:icon.querySelector('img').getAttribute('src')}})())")
        print("NATIVE_SWITCH_METRICS \(iconMetrics)")
        XCTAssertEqual(iconAligned, true)
        var shot = XCTAttachment(image: try await session.webView.takeSnapshot(configuration: nil))
        shot.name = "Native switch icon alignment"; shot.lifetime = .keepAlways; add(shot)
        _ = try await js("document.querySelector('.pet-row:not(.selected)').click();true")
        try await waitFor("document.querySelector('.screen-home')!==null")
        _ = try await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='进入对话').click();true")
        try await waitFor("document.querySelector('.composer textarea')!==null")
        _ = try await js("window.fixtureSend(window.partialFixture.input);true")
        try await waitFor("!document.querySelector('.composer .send').disabled")
        _ = try await js("document.querySelector('.composer .send').click();true")
        try await waitFor("JSON.parse(localStorage.getItem('pawmemo:lifecycle:v1')).data.memories.length===2&&[...document.querySelectorAll('.chat-bubble:not(.owner)')].some(e=>e.textContent===window.partialFixture.result.clarification)")
        let validFirst = try await js("(()=>{const d=JSON.parse(localStorage.getItem('pawmemo:lifecycle:v1')).data;return d.memories.every((m,i)=>m.raw===window.partialFixture.input&&m.quote===window.partialFixture.result.facts[i].quote&&JSON.stringify(m.versions[0].tags)===JSON.stringify(window.partialFixture.result.facts[i].tags))&&d.messages[0].answerState==='done'})()") as? Bool
        XCTAssertEqual(validFirst, true)
        shot = XCTAttachment(image: try await session.webView.takeSnapshot(configuration: nil))
        shot.name = "Native known facts saved while clarifying"; shot.lifetime = .keepAlways; add(shot)
        _ = try await js("document.querySelector('[aria-label=查看记忆]').click();true")
        try await waitFor("document.querySelectorAll('.inline-memory').length===2")
        let readonlyTags = try await js("document.querySelectorAll('.inline-memory input').length===0&&document.querySelectorAll('.inline-memory .tag').length===4") as? Bool
        XCTAssertEqual(readonlyTags, true)
        shot = XCTAttachment(image: try await session.webView.takeSnapshot(configuration: nil))
        shot.name = "Native two saved facts and system tags"; shot.lifetime = .keepAlways; add(shot)
        _ = try await js("document.querySelector('.page-nav [aria-label=返回]').click();true")
        try await waitFor("document.querySelector('.composer textarea')!==null")
        _ = try await js("window.fixtureSend('后来咪咪躲到了床底。');true")
        try await waitFor("!document.querySelector('.composer .send').disabled")
        _ = try await js("document.querySelector('.composer .send').click();true")
        try await waitFor("JSON.parse(localStorage.getItem('pawmemo:lifecycle:v1')).data.memories.length===3")
        let followupValid = try await js("(()=>{const d=JSON.parse(localStorage.getItem('pawmemo:lifecycle:v1')).data,requests=window.partialRequests;return requests.length===2&&requests[1].history.some(h=>h.clarification===window.partialFixture.result.clarification)&&requests[1].memories.length===2&&d.memories.filter(m=>m.quote==='后来咪咪躲到了床底。').length===1&&d.memories.every(m=>m.petId===d.activePetId)})()") as? Bool
        XCTAssertEqual(followupValid, true)
        _ = try await js("document.querySelector('[aria-label=查看记忆]').click();true")
        try await waitFor("document.querySelectorAll('.inline-memory').length===3")
        shot = XCTAttachment(image: try await session.webView.takeSnapshot(configuration: nil))
        shot.name = "Native followup adds one fact without duplicates"; shot.lifetime = .keepAlways; add(shot)
        print("NATIVE_PARTIAL_REPLAY observations: 2 known facts, separate clarification, 1 followup fact, 2 fixture requests, 0 external calls")
    }
    func testNativeAudioCanonicalWaveAndBridgeRejectsInvalidAction() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("native-wave-fixture.wav")
        defer { try? FileManager.default.removeItem(at: url) }
        var raw = Data()
        func word(_ s: String) { raw.append(contentsOf: s.utf8) }
        func short(_ n: UInt16) { var v = n.littleEndian; withUnsafeBytes(of: &v) { raw.append(contentsOf: $0) } }
        func long(_ n: UInt32) { var v = n.littleEndian; withUnsafeBytes(of: &v) { raw.append(contentsOf: $0) } }
        word("RIFF"); long(36+32000+12); word("WAVEfmt "); long(16)
        short(1); short(1); long(16000); long(32000); short(2); short(16)
        word("JUNK"); long(3); raw.append(contentsOf: [1,2,3,0]) // Odd chunks are padded.
        word("data"); long(32000)
        for i in 0..<16000 { short(UInt16(bitPattern: Int16(8192 * sin(Float(i) * 2 * .pi * 440 / 16000)))) }
        try raw.write(to: url)
        let wav = try NativeVoiceRecorder.readWave(url)
        XCTAssertEqual(wav[44...], raw.suffix(32000))
        XCTAssertEqual(wav.count, 32044)
        XCTAssertEqual(String(data: wav[0..<4], encoding: .ascii), "RIFF")
        XCTAssertEqual(String(data: wav[36..<40], encoding: .ascii), "data")
        XCTAssertEqual(Array(wav[24..<28]), [128, 62, 0, 0]) // 16000 Hz little endian
        XCTAssertTrue(wav[44...].contains(where: { $0 != 0 }))
        _ = try await js("window.webkit.messageHandlers.pawmemoAudio.postMessage({action:'invalid',id:'fixture'}).catch(e=>window.bridgeRejected=String(e));true")
        try await waitFor("typeof window.bridgeRejected==='string'")
        let error = try await js("window.bridgeRejected") as? String
        XCTAssertTrue(error?.contains("录音操作无效") == true)
    }
    func testWKPCMResamplingAndDraftReturnWithoutCodecs() async throws {
        let bridge = try await js("typeof window.webkit.messageHandlers.pawmemoAudio.postMessage") as? String
        XCTAssertEqual(bridge, "function")
        session.webView.configuration.userContentController.removeScriptMessageHandler(forName: "pawmemoAudio", contentWorld: .page)
        _ = try await js("""
        (()=>{
        navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){}}]});
        // Synthesize microphone frames only; keep the real WebKit PCM resampler.
        window.MediaRecorder=class {constructor(){throw Error('Codec path must not be used')}};
        OfflineAudioContext.prototype.decodeAudioData=()=>{throw Error('Codec decoding must not be used')};
        window.AudioContext=class {
          constructor(){this.sampleRate=48000;this.state='running'}
          resume(){return Promise.resolve()}
          close(){this.state='closed';return Promise.resolve()}
          createMediaStreamSource(){return {connect(){},disconnect(){}}}
          createGain(){return {gain:{value:1},connect(){},disconnect(){}}}
          createScriptProcessor(){let timer;const node={onaudioprocess:null,
            connect(){const samples=Float32Array.from({length:4096},(_,i)=>.25*Math.sin(2*Math.PI*440*i/48000));timer=setInterval(()=>node.onaudioprocess?.({inputBuffer:{getChannelData:()=>samples}}),4096/48000*1000)},
            disconnect(){clearInterval(timer)}};return node;}
        };
        window.fetch=async(url,options)=>{
          if(String(url)!=='/api/transcriptions')throw Error('External requests forbidden in native audio fixture');
          const blob=options.body.get('audio'), buffer=await blob.arrayBuffer(), v=new DataView(buffer);let peak=0,sum=0;
          for(let at=44;at<buffer.byteLength;at+=2){const value=v.getInt16(at,true)/32768;peak=Math.max(peak,Math.abs(value));sum+=value*value;}
          window.nativeAudioEvidence={type:blob.type,bytes:buffer.byteLength,sampleRate:v.getUint32(24,true),channels:v.getUint16(22,true),peak,rms:Math.sqrt(sum/((buffer.byteLength-44)/2))};
          return new Response(JSON.stringify({text:'合成音频测试文字'}),{status:200,headers:{'Content-Type':'application/json'}});
        };
        [...document.querySelectorAll('button')].find(b=>b.textContent==='建立宠物档案').click();})();true
        """)
        try await waitFor("document.querySelector('[name=name]')!==null")
        _ = try await js("""
        (()=>{const name=document.querySelector('[name=name]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(name,'Audio Fixture');name.dispatchEvent(new Event('input',{bubbles:true}));
        const kind=document.querySelector('[name=kind]');kind.value='猫';kind.dispatchEvent(new Event('change',{bubbles:true}));})();true
        """)
        try await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent==='创建档案' && !b.disabled)")
        _ = try await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='创建档案').click();true")
        try await waitFor("document.querySelector('.screen-home')!==null")
        _ = try await js("document.querySelector('.home-hold-record').click();true")
        try await waitFor("document.querySelector('.home-hold-record').dataset.phase==='recording'")
        try await Task.sleep(nanoseconds: 2_000_000_000)
        _ = try await js("document.querySelector('.home-hold-record').click();true")
        try await waitFor("document.querySelector('.composer textarea')?.value==='合成音频测试文字'")
        let raw = try await js("JSON.stringify(window.nativeAudioEvidence)") as! String
        print("NATIVE_AUDIO_EVIDENCE " + raw)
        let result = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as! [String: Any]
        XCTAssertEqual(result["sampleRate"] as? Int, 16000)
        XCTAssertEqual(result["channels"] as? Int, 1)
        XCTAssertGreaterThan(result["bytes"] as! Int, 32000)
        XCTAssertGreaterThan(result["rms"] as! Double, 0.05)
        let unsent = try await js("JSON.parse(localStorage.getItem('pawmemo:lifecycle:v1')).data.messages.length") as? Int
        XCTAssertEqual(unsent, 0)

    }
    func testSimulatorMicrophoneSignalDiagnosticWithoutExternalRequests() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["PAWMEMO_MIC_DIAGNOSTIC"] == "1", "Interactive microphone diagnostic is opt-in")
        _ = try await js("""
        (async()=>{let stream,ctx;
        try{stream=await navigator.mediaDevices.getUserMedia({audio:true});
        ctx=new AudioContext();await ctx.resume();const source=ctx.createMediaStreamSource(stream),analyser=ctx.createAnalyser();source.connect(analyser);
        const samples=new Float32Array(analyser.fftSize);let peak=0,sum=0,count=0;
        const timer=setInterval(()=>{analyser.getFloatTimeDomainData(samples);for(const value of samples){peak=Math.max(peak,Math.abs(value));sum+=value*value;count++;}},50);
        await new Promise(r=>setTimeout(r,5000));clearInterval(timer);
        window.nativeMicEvidence={devices:(await navigator.mediaDevices.enumerateDevices()).map(d=>({kind:d.kind,label:d.label})),settings:stream.getAudioTracks()[0].getSettings(),peak,rms:Math.sqrt(sum/Math.max(1,count)),sampleCount:count,contextState:ctx.state,trackState:stream.getAudioTracks()[0].readyState,muted:stream.getAudioTracks()[0].muted};
        }catch(e){window.nativeMicEvidence={error:e.name,message:e.message}}finally{stream?.getTracks().forEach(t=>t.stop());if(ctx)await ctx.close();window.nativeMicDone=true;}})();true
        """)
        for _ in 0..<900 {
            if (try? await js("window.nativeMicDone===true") as? Bool) == true { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let evidence = try await js("JSON.stringify(window.nativeMicEvidence)") as? String
        print("SIMULATOR_MIC_SIGNAL " + (evidence ?? "no result"))
        XCTAssertNotNil(evidence)
    }
    func testRecoverableConnectionFailureAndRetryWithoutClearingData() async throws {
        session.webView(session.webView, didFailProvisionalNavigation: nil, withError: URLError(.cannotConnectToHost))
        XCTAssertEqual(session.state, .failed)
        session.reconnect()
        try await waitFor("document.querySelector('.app-shell')!==null")
        for _ in 0..<100 where session.state != .ready { try await Task.sleep(nanoseconds: 100_000_000) }
        XCTAssertEqual(session.state, .ready)
    }
}
