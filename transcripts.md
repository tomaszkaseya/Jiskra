Review Jiskra - ONP , OA review-20261020_110000UTC-Meeting Recording
October 20, 2026, 11:00AM
30m 18s

 started transcription

Norbert Wojcicki   0:23
Low.

Anton Bondarenko   0:37
Hello.

Tomasz Mazurek   0:59
Hello, everyone.

Michał Roztoczyński   1:01
Oh, I can't even hear you. What a nice pair of headphones.

Tomasz Mazurek   1:09
Vyas.
Find a way.
Local host 1447.
Norbert, you with us? Are you live? You okay?

Norbert Wojcicki   1:40
Yeah, sorry. I am okay. It's like I start happening around 2, then it's like peaks at 5 A.m. and then like gives me a break for half a day. So now I am fine. I expect soon I will not be so.

Tomasz Mazurek   1:40
How do you feel?

Norbert Wojcicki   2:00
I have another doctor tomorrow, so I will be known tomorrow.

Michał Roztoczyński   2:05
I know that no one asks, but you definitely don't sound very good, being honest.

Norbert Wojcicki   2:12
Really? Oh, okay. I didn't notice.

Tomasz Mazurek   2:17
The.

Michał Roztoczyński   2:19
Just tired, you know.

Tomasz Mazurek   2:19
I don't hear that that well, so I want to cheer you up that you sound good.

Norbert Wojcicki   2:24
Thank you.

Tomasz Mazurek   2:27
All right.
Appliance page.
Post to 29th, is there any risk related to that? Something to bring to the forum, something to report for tomorrow or today?

Ekaterina Pavlovskaya   2:43
No, we are on track.

Tomasz Mazurek   2:50
So, looks like that would be it for day three.
The challenge just begins here.
So yesterday I spoke, so this OA132, so enter ID.
So that blocker, I spoke with Hrel and he said that they'll still has the QA restrictions and he even said that he needs a few weeks more. I'm not sure if anyone has better updates than that.
That he, for example, said what? Yeah, sorry.

Michał Roztoczyński   3:27
Last time we spoke, actually...
Yeah, we were meeting with Tom.
On Thursday, our last time, and that's the only update they they had, but we even proposed to help them out with queuing stuff, but like...
Okay, please provide more input than that, but it seems like we want to verify what we can on our side, but it still won't be enough. So, like...
We are.
Like, this is the current status.
But we are blocked and this is blocked by QA capacity.

Ekaterina Pavlovskaya   4:13
Yeah, they mentioned that they have other tickets in the queue and they don't want to cherry pick just ours.

Michał Roztoczyński   4:21
Yeah, that's also one of the ideas to just cherry pick our our address, but I I think they implied that it's not possible, but I'm not entirely sure if this.

Ekaterina Pavlovskaya   4:34
It's possible.

Michał Roztoczyński   4:37
Yeah.
I mean, it sounded like they were saying that it's not possible, but something seems like they are not willing to do that.

Tomasz Mazurek   4:49
Right.

Michał Roztoczyński   4:49
Which is fair, like they could use it for their own leverage, say that.
To gain those QAs, maybe that's what they are trying. I don't know.

Tomasz Mazurek   5:03
So, to sum up for now, just entire ID is still the same state as it was, so the development is complete, but the button that is the QA.

Michał Roztoczyński   5:13
Yes.

Tomasz Mazurek   5:14
Any update on DBMA v2 in one API?

Norbert Wojcicki   5:16
So I'm sorry, I'm still raising this thing about Entra. Development is done because I asked about this organization thing and there was no update on that.

Tomasz Mazurek   5:23
That's what they claim.

Michał Roztoczyński   5:26
Oh.
There is. They are pushing up. There are pushing regions. We were just not finding that, but this was a small ticket. It was already reported. I didn't check, but I know that Maxim was taking a look into this.

Norbert Wojcicki   5:44
That's also great, but I'm talking about C2s.

Ekaterina Pavlovskaya   5:48
And that's what this blocker is about.

Norbert Wojcicki   5:52
So they finish development, but for them to get this, work needs to be done in Uniview. There is no reach out.

Ekaterina Pavlovskaya   5:59
They said that they have it. I will create a ticket for updates, but they said that they have it already.

Norbert Wojcicki   6:08
Alright, alright then.

Tomasz Mazurek   6:13
Can I ask you guys to sync also outside of this meeting?

Norbert Wojcicki   6:21
Like them.

Tomasz Mazurek   6:26
All right, DBMAV2 in Azure. Ah, in one API.

Michał Roztoczyński   6:34
I think we see small issue with risk calculation, so we are, I'm just creating a chart to get it resolved because we are not receiving events about failed backups.
And DBMA says that they are sending those events.
Yeah, so.
I don't know if I would raise this as a risk just yet, but we hit a block with implementing the risk and...
Work is ongoing on getting this implemented, resolved, resolved, not implemented.

Tomasz Mazurek   7:18
No, that's okay. All right. So with this DVMA, this is a potential risk that we are not describing that. Okay. All right.

Michał Roztoczyński   7:27
I mean, the worst case scenario, I think that would be acceptable from product perspective. I haven't heard from Matt, but we will just release DBMA without risk or population.
But let's go, no, let's not go over that, maybe, it's too early.
For EBV2, similar story. It's just that we haven't heard from them. So the current status for the risk score is that we are not receiving information about failed backups.

Tomasz Mazurek   7:48
Error.

Michał Roztoczyński   8:01
Ohh...
And I haven't heard from them yet.

Anton Bondarenko   8:07
It's not just re-score, then last backups are also inconsistent here, if we are not receiving bad backups.

Michał Roztoczyński   8:08
Yeah.
Yeah, basically, yeah, yeah, that is correct. We would be so, so the way it looks for us is that every failed backup is re-attempted until it succeeded.

Anton Bondarenko   8:17
So, Asima.

Michał Roztoczyński   8:30
So that would make all of the, that would make all of the top screen.
All the time for those.

Anton Bondarenko   8:35
So I think we need to resolve it before releasing. It's not just risk or like the whole value is lost without it.

Michał Roztoczyński   8:44
Yep.
All right.

Tomasz Mazurek   8:49
Right, so let's just keep talking with them and verify this one. If we don't have that, further decision, how do we handle those situations?

Michał Roztoczyński   8:57
I kicked off the discussion on product level with everyone involved, Anton, myself, Natalia, Bjorn, and Matt.

Tomasz Mazurek   9:07
Thank you.
And moving on to public AP.

Michał Roztoczyński   9:12
This one looks Grainne.
Ohh, I just spoke today with...
Piotr, he is not blocked with anything. He, the question right now he has to Kirwan is how we are going to show like different environments because like the main API URL will be used for.
URI, it will be used for public access.
And the question about staging and development environments, but other than that, like he has a ticket assigned, he's working on infrastructure, and then soon he should be preparing a ticket for Nathan, and then obviously we will need to trace that ticket.
But we are not there yet.

Tomasz Mazurek   10:04
That's excellent. All right, so I guess no more updates for Hello API? You've already spoken about this or any more that you want to cover?

Michał Roztoczyński   10:13
That one goes for resolution center. So there was quite a heat around it yesterday and two days ago, but I think that we got it resolved and.
Um...
Yeah, these signs were updated.
Oh no, no, there is actually quite a big issue here. Sorry.
So yeah, what I was just about to say is about design stuff from Tatiana and data structure. So that part is aligned. But maybe you remember, maybe not, we've got the list of error codes from SAS P team.
And turns out that they are, there are many issues with that list. Now with Weronika in USA, still, I'm waiting here as well for the reply because I raised four points about how we could address that. Long story short, some errors are not
not covered, some errors are duplicated, some errors have wrong error codes.
Well, there is a lot of issues with that list.

Tomasz Mazurek   11:28
Okay, so...
We have a potential issue here on some on the error code list, and I guess this will should be expedited by SAS protection team product team.

Michał Roztoczyński   11:41
That was I with my message I implied that I'm expecting them to action this missed.

Tomasz Mazurek   11:49
So good, we will have them, I hope, in two hours to act on those. So in here, the simple is just, let's just use Rick for that to help them answer.

Michał Roztoczyński   12:00
Okay, I mean, let's start, like, this is very fresh from my message. Like, we noticed that yesterday evening, so I replied today morning.
But, probably.

Tomasz Mazurek   12:14
Let's just not use the word escalate in this conversation, but for now, we are just, you know, so Michal says on the meeting that I asked you a question yesterday, and please, we are kind of blocked by you not answering that. And if you don't answer by Thursday, this is escalation. Kidding, we don't have to add to the other one.

Michał Roztoczyński   12:33
Yeah, I made a similar joke last week.
I can relate to that.

Tomasz Mazurek   12:40
Alright, moving on to UDV sync with one portal out web.
I have not seen that one.
This is that new one, right, Norbert, that you mentioned.

Anton Bondarenko   12:55
No, I found it just today in the list and edit tag.

Norbert Wojcicki   12:59
This is a...
So, this is a prerequisite for merge. Basically, it allows you to go to move Univiewer seller into one portal without DPP, right? It is tested by us, but we won't enable this until DPP, sorry, one, let's say DPP provisioning is fixed.
because if we just enable that functionality, DVP is not aware of universal and will create duplicates. So we coded it, it is possible to enable it, but we cannot. And also its base case for merger. Without this sync, we could not do merger.

Anton Bondarenko   13:44
Provisioning is in the next gate. Does it mean we need to bring it to this one?

Norbert Wojcicki   13:51
Yeah, yeah, it's like the code is already there, but we will not enable that until the provisioning is done.

Gustavo Kozima da Silva   13:59
So auto provisioning is blocking that.

Norbert Wojcicki   14:03
Yes, it's blocking that and also blocking.
Provisioning Uniview into one portal straight from the auto provisioning.

Gustavo Kozima da Silva   14:18
What, when, when is do I need to leave the merger?

Norbert Wojcicki   14:23
I mean, it doesn't doesn't block merge is like other cases of moving customer tenants from Uniview to 1 portal, like there are like I think six of them have a table somewhere I presented to Matt. He was fine with doing that way, so basically we only will support.
port Uniview merge to existing DPP for now. Other cases, I have two more epics to do them. One is done but will not release it, and one is out of scope for now, waiting for also for auto provisioning.

Tomasz Mazurek   15:06
Okay.
I'll get a sense out of this.

Norbert Wojcicki   15:08
Should I should I write this this cool table for you guys?

Tomasz Mazurek   15:17
Not sure if we need to, let's just, I'll try to gather this thing.
If I have questions, I'll ask you.

Norbert Wojcicki   15:24
I, I, I have it ready, so I just paste it.

Tomasz Mazurek   15:31
So, for the resolution center on the portal site, I guess.
There's no work to be done there until we have an AP.

Michał Roztoczyński   15:44
The issue with...
error codes came out of the actual attempt of implementing the portal site. So it was actually Semen Kwoka who brought that up because he was trying to implement those error codes.
Like ready for QA, I don't think it's...
Okay, that part there, okay, yeah.

Anton Bondarenko   16:17
For how long have we blocked?

Michał Roztoczyński   16:22
Ohh, since yesterday evening.

Anton Bondarenko   16:26
No, no, I mean in the future, like looking into the future. Is it a big issue or is it?

Michał Roztoczyński   16:34
I don't know, one of my proposals to SASP was to just apply this list blindly with small changes which are obvious and hope for the best, but that would lead us to present better error codes whenever they appear, which...
doesn't look right, so it's not a great option. But other option of actually fixing stuff would require them to review entire list, which I think might be big of an Ask from that team.

Tomasz Mazurek   17:06
So help me out understand here. So is there is any going to be a development on their side to resolve this one? Or this is just a product decision from Weronika?

Michał Roztoczyński   17:18
First is a product decision. If we are, I don't like this way, but if we are okay with staying with current list, and we can just apply it blindly with small changes, it will display, but very often we will display, I don't know how often, sometimes we will display.
bad error codes because we don't have associated error messages.
Dan, if we would like to get it fixed.
This is not like a crazy ask, but quite a substantial amount of work to review all of the error codes which are missing. There are dozens. And fix them.

Anton Bondarenko   18:02
Can we go ahead with those which are field, like to filter those which has empty field but still reply with those which are ready?

Tomasz Mazurek   18:03
Rick.

Michał Roztoczyński   18:17
I think you are in the chat which I sent a message. Please take a look because it's not obvious. Some errors are just plain wrong. So wrong.

Anton Bondarenko   18:21
Yeah.

Michał Roztoczyński   18:29
error message associated to different error code. So like wrong mapping of a message to an error code.
So that's what I meant when I was saying there is a lot of issues with that list.

Anton Bondarenko   18:47
Thank you.

Michał Roztoczyński   18:49
But yeah, I tried to summarize.

Tomasz Mazurek   18:49
So my opinion on this is, yeah, good. Now just follow up with them. But at some point, my thinking is that, well, you just guys sending us this list. So we can only process that list. And if we display wrongly,
Then I guess...
We display wrongly, I mean.

Michał Roztoczyński   19:11
Yeah, yeah, that's option three I sent to Weronika.

Tomasz Mazurek   19:21
Alright, thank you. My favorite ones, tenant merge.

Norbert Wojcicki   19:30
Right, so I pasted the table, so I hope it's readable about this, so...
Air created the part of API, cause also not blocking us with anything. Now Alexander is in progress of coding and the tool we need to use for coding.
Cause organization remap, so he's writing the code on Uniview, so that's good. You know, the work is progressing to unblock the cause.

Tomasz Mazurek   20:12
So, suggestion would be probably that we can lower that from high to medium.

Norbert Wojcicki   20:17
Yes, he, I mean, he wrote like 30 minutes ago that he cannot access their API, but that's, you know, integration hell, let's say. They say it's completed, we cannot access it, we need some back and forth, but it's not like they have not done anything like they used to have. So it is medium.
Like, if it was high, now it's medium.

Tomasz Mazurek   20:39
Good. What about this error thing? You say that this is unblocking us completely, so we can close this risk?

Norbert Wojcicki   20:41
So.
Yeah, for now, before they go to cost, we are unlocked. And so Alexander is actually having three stories. One is to unlock cost, one is to unlock air on universe side. So we have the tool, we just call it.
And one thing is to hide broken appliances if they ever happen during this process. So yeah, here's unblocking all everything with this ticket I sent last time and send it once more.

Michał Roztoczyński   21:14
If...
Yep.
If I might, let's not remove this risk console. It's actually on production because like...

Norbert Wojcicki   21:27
Yeah, but this is slow. What is?

Michał Roztoczyński   21:29
Yeah, yeah, because Tomasz was suggesting removing the risk, like I would propose to put it, keep it as a low risk.

Norbert Wojcicki   21:38
Yeah, I agree.

Tomasz Mazurek   21:44
I need to think about that one, because we have we open risks and we have a mitigations plan and we act on them to close the risks.
But all right, I'll think about this outside of this meeting.

Norbert Wojcicki   21:56
So, it's a separate tracked item, so once it's closed, you know, on production, you can close the risk, right, because Alexander can be hit by bus or whatever.
Then, we will raise this risk.

Tomasz Mazurek   22:15
Okay guys, have it your way. Tenant API keys management.
Has anything started here?
Last time you said the composition with the complete discovery with a team next as that happened.

Norbert Wojcicki   22:33
I.

Gustavo Kozima da Silva   22:34
We haven't done the refinement.
Yet, but I'll set up a meeting tomorrow to do it, and then we can start picking up the tickets.

Tomasz Mazurek   22:37
Sorry.
Next one is.
Another new one, DVP shared provisioning on one portal draft.

Norbert Wojcicki   23:04
So I hope this is the, I hope that's the auto provision one.

Tomasz Mazurek   23:04
That's thirty-five percent.

Norbert Wojcicki   23:11
or part of it.
Ah, okay, okay, okay. I know, I know, I know what it is. I know what it is. This is all the items that were moved out of scope of from migration.

Tomasz Mazurek   23:20
There's just no way of knowing, man.

Norbert Wojcicki   23:31
Uh, which is...
Exactly what it says. Uniview and DP shared provisioning. Right now, we cannot enable Uniview auto provisioning to 1 portal because DPP will just make the applicates. And vice versa. DPP, I mean, DPP could do it, but they don't have auto provisioning done. So we had.
two milestones to cover that case is when you just create new resellers or new view, uniview and DPP are already on one portal, which we cannot do because auto provisioning is not owned by us. So that's the out of scope items here.

Tomasz Mazurek   24:10
So is it out of scope gate 42?

Norbert Wojcicki   24:15
I mean, that's a, that's the, I don't know why we want to do that for sure. We cannot do this before auto-provisioning.

Anton Bondarenko   24:26
So either we move all of those epics to gate 5 or we move auto provisioning here to gate 4.

Tomasz Mazurek   24:39
It's already like that, so who's opening that epic? Jesus, I can do it.
There's no big deal, it's just some sort of an order.

Anton Bondarenko   24:58
And we put it in gate 5 because of the size and other priorities. That's why.

Norbert Wojcicki   25:08
Yeah, and so the...

Tomasz Mazurek   25:08
I see you here.

Anton Bondarenko   25:08
He told them.

Norbert Wojcicki   25:10
That thing has a draft attached to it because I just moved the item away from merger since I know we will not do that right now and you didn't want to have low percentages because it will be never be completed before auto provisioning. So it's just a home for these items now.

Tomasz Mazurek   25:27
Oh, Jesus, what a stupid guy I am.
OMB.
If life.
This one, this is the BMA one.
Any progress in this one?
Portal side.

Ekaterina Pavlovskaya   26:00
First release is started in next week, but there will be more improvements.
Probably, yes, yes.

Tomasz Mazurek   26:08
So initial release is happening next week for this one. That's what you're saying.
What about this one, probably, too?

Ekaterina Pavlovskaya   26:16
The same, yes.

Tomasz Mazurek   26:18
And point back up with, so integrate the EBDR with one portal.
integrate endpoint backup V2 with one portal. This is.
Tied to API.

Ekaterina Pavlovskaya   26:28
All 3, yes, and we are working on designs for our meetings today about it. So once it's ready, we'll start working on them.

Tomasz Mazurek   26:41
That Azure V2, same story, anything different here.

Ekaterina Pavlovskaya   26:43
Yes, and and enter the same.

Anton Bondarenko   26:47
For Entra and Azure, we have designs we need to review them with Alexander and Natalia this week and to look together with Mikailov, like, what's lacking from one API side, like, what can we bring now, what we should postpone.

Michał Roztoczyński   27:10
Yep, we have meetings.

Tomasz Mazurek   27:13
All right, then grade 5, I'll just leave out of today's scope. I don't have Denis any way for global search.

Michał Roztoczyński   27:21
But yeah, items, items are starting to appear slowly. So we are populating 8, 5, and six.

Tomasz Mazurek   27:23
But you know.
Ohh.
Tough one. All right, guys. Thank you for today.
Next week, we're going to have a ghost from US. And apparently there are issues all over the place in our site. So if someone wants to raise something, just let me know an issue, site related issue, team related issue, how we operate, how engineering product is working, cooperating, anything that is, you know.
On the HR level that we need to raise, or on the product level, we need to raise.

Michał Roztoczyński   28:12
Who is coming from US?

Tomasz Mazurek   28:15
Ohh.
Some other tools like Sudeep, and I think Grant also invited Pratik is not coming, and it's gonna be Madhumita from HR too. Yeah, we can discuss more this one tomorrow on our, you know, regular meeting, but that's happening. There's more interesting story on Go work, and this is related to that, so...

Michał Roztoczyński   28:25
Right.

Tomasz Mazurek   28:39
If you have free time later on today, so we can just take a look.
But just not to keep you in the dark when this is what I was.
This morning and yesterday's something.
All right, for today, I will create a report and update the tool so we have a clear picture for the next meeting. But basically, on the next meeting, we provide a summary of how we're progressing. So the most important ones are going to be enter ID. So that one.
that we are still blocked by ENTRA and then we'll have Hrel ask to the table and provide answer what can be done there.
Then, the another one would be the merge, so we provide the answer on error that unblocked us, but we keep the risk, but the error costs we lower the risk because of the...
progress with costs.
I do that now.
Anything else that I missed?

Michał Roztoczyński   29:47
Sounds good.

Tomasz Mazurek   29:48
All right, guys, and keep up the good work. We talk more tomorrow about, you know, org changes that are happening as well within our teams. So let's just stay put for this one. For tomorrow, I don't intend to go to statuses at all, because I don't want to bore you with that.
All right, thank you very much. Have a good rest of the day.

Michał Roztoczyński   30:10
Thank you very much.

Tomasz Mazurek   30:10
Bye bye.

Norbert Wojcicki   30:11
Bye.

Michał Roztoczyński   30:12
See you.

Tomasz Mazurek stopped transcription
