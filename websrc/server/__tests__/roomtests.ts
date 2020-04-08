import { ServerRoomCallbacks, RoomMemberGadget, RoomMessageTypePrivate, RMAddGadget, RMRemoveGadget, RMUpdateGadgetHook, updateLocalGadgetHook } from './../rooms';
import { GadgetRoomCallbacks, GadgetRoomEnvelope, RMMemberJoined, RoomMessageType, RoomMemberIdReserved, RMMemberLeft } from '@aardvarkxr/aardvark-shared';
import { destroyLocalGadget, createRoom, addRoomMember, removeRoomMember, onRoomMessage } from '../rooms';

beforeEach( async() =>
{
} );

afterEach( () =>
{
} );

function emptyCallbacks(): ServerRoomCallbacks
{
	return ( 
		{
			sendMessage: ( message: GadgetRoomEnvelope ) => {},
			getSharedGadgets: () => { return [] },
			addRemoteGadget: ( memberId: string, gadget: RoomMemberGadget ) => {},
			removeRemoteGadget: ( memberId: string, persistenceUuid: string ) => {},
			updateRemoteGadgetHook: ( memberId: string, persistenceUuid: string, newHook: string ) => {},
		} );
}

function joinMessage( memberId: string ): RMMemberJoined
{
	return (
		{
			type: RoomMessageType.MemberJoined,
			source: RoomMemberIdReserved.Room,
			memberId,
		}
	);
}

function leftMessage( memberId: string ): RMMemberLeft
{
	return (
		{
			type: RoomMessageType.MemberLeft,
			source: RoomMemberIdReserved.Room,
			memberId,
		}
	);
}

function addGadgetMessage( ownerId: string, gadgetUri: string, persistenceUuid: string,
	hook?: string ): RMAddGadget
{
	return (
		{
			type: RoomMessageTypePrivate.AddGadget,
			source: ownerId,
			gadgetUri,
			persistenceUuid,
			hook,
		}
	);
}

function removeGadgetMessage( ownerId: string, persistenceUuid: string ): RMRemoveGadget
{
	return (
		{
			type: RoomMessageTypePrivate.RemoveGadget,
			source: ownerId,
			persistenceUuid,
		}
	);
}

function updateGadgetHookMessage( ownerId: string, persistenceUuid: string, 
	newHook: string ): RMUpdateGadgetHook
{
	return (
		{
			type: RoomMessageTypePrivate.UpdateGadgetHook,
			source: ownerId,
			persistenceUuid,
			newHook: newHook,
		}
	);
}

interface RemoteGadget extends RoomMemberGadget
{
	ownerId: string;
}

class GadgetRoomTestCallbacks implements ServerRoomCallbacks
{
	public localGadgets:RoomMemberGadget[];
	public remoteGadgets: RemoteGadget[] = [];
	public outgoingMessages: GadgetRoomEnvelope[] = [];

	constructor( gadgetList?: RoomMemberGadget[] )
	{
		this.localGadgets = gadgetList ?? [];
	}

	// --------------------------------------------------------------------
	// ServerRoomCallbacks implementation
	// --------------------------------------------------------------------
	public sendMessage( message: GadgetRoomEnvelope )
	{
		this.outgoingMessages.push( message );
	}

	public getSharedGadgets(): RoomMemberGadget[]
	{
		return this.localGadgets;
	}

	public addRemoteGadget( memberId: string, gadget: RoomMemberGadget )
	{
		this.remoteGadgets.push( 
			{
				...gadget,
				ownerId: memberId,
			}
		)
	}

	public removeRemoteGadget( memberId: string, persistenceUuid: string )
	{
		let gadgetIndex = this.remoteGadgets.findIndex( ( gadget: RemoteGadget ) =>
		{
			return gadget.ownerId == memberId && gadget.persistenceUuid == persistenceUuid;
		} );
		if( gadgetIndex != -1 )
		{
			this.remoteGadgets.splice( gadgetIndex, 1 );
		}

	}

	public updateRemoteGadgetHook( memberId: string, persistenceUuid: string, newHook: string )
	{
		let gadgetIndex = this.remoteGadgets.findIndex( ( gadget: RemoteGadget ) =>
		{
			return gadget.ownerId == memberId && gadget.persistenceUuid == persistenceUuid;
		} );
		if( gadgetIndex != -1 )
		{
			this.remoteGadgets[ gadgetIndex ].hook = newHook;
		}
	}

	// --------------------------------------------------------------------
	// Helpers for analysing test results
	// --------------------------------------------------------------------
	public getMessagesOfTypeAndDestination( destination: string, type: string )
	{
		return this.outgoingMessages.filter( ( value: GadgetRoomEnvelope ) =>
		{
			return value.destination == destination && value.type == type;
		} );
	}

	public countAddGadget( destination: string, gadgetUri: string, persistenceUuid: string )
	{
		let count = 0;
		for( let message of 
			this.getMessagesOfTypeAndDestination( destination, RoomMessageTypePrivate.AddGadget ) )
		{
			let m = message as RMAddGadget;
			if( m.gadgetUri == gadgetUri && m.persistenceUuid == persistenceUuid )
			{
				count++;
			}
		}

		return count;
	}

	public countRemoveGadget( destination: string, persistenceUuid: string )
	{
		let count = 0;
		for( let message of 
			this.getMessagesOfTypeAndDestination( destination, RoomMessageTypePrivate.RemoveGadget ) )
		{
			let m = message as RMRemoveGadget;
			if( m.persistenceUuid == persistenceUuid )
			{
				count++;
			}
		}

		return count;
	}
}

describe( "server ", () =>
{
	it( "create", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		expect( room.roomId ).toBe( "fred" );
		expect( room.gadgetPersistenceId ).toBe( "sam" );
	} );

	it( "addMember", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		addRoomMember( room, "julie" );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "julie" );
	} );

	it( "dupMember", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		addRoomMember( room, "julie" );
		addRoomMember( room, "julie" );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "julie" );
	} );

	it( "removeMember", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		addRoomMember( room, "julie" );
		addRoomMember( room, "christine" );
		expect( room.members.length ).toBe( 2 );
		removeRoomMember( room, "julie" );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "christine" );
	} );

	it( "addMemberFromMessage", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		onRoomMessage( room, joinMessage( "julie" ) );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "julie" );
	} );

	it( "dupMemberFromMessage", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		onRoomMessage( room, joinMessage( "julie" ) );
		onRoomMessage( room, joinMessage( "julie" ) );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "julie" );
	} );

	it( "removeMemberFromMessage", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		onRoomMessage( room, joinMessage( "julie" ) );
		onRoomMessage( room, joinMessage( "christine" ) );
		expect( room.members.length ).toBe( 2 );
		onRoomMessage( room, leftMessage( "christine" ) );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "julie" );
	} );

	it( "addGadgetToPeer", async () =>
	{
		let callbacks = new GadgetRoomTestCallbacks(
			[
				{
					gadgetUri: "http://mygadget.com",
					persistenceUuid: "mustang"				
				}	
			]
		);

		let room = createRoom( "fred", "sam", callbacks );
		onRoomMessage( room, joinMessage( "julie" ) );

		expect( callbacks.outgoingMessages.length ).toBe( 1 );
		expect( callbacks.countAddGadget( "julie", "http://mygadget.com", "mustang" ) ).toBe( 1 );
	} );

	it( "removeGadgetToPeer", async () =>
	{
		let callbacks = new GadgetRoomTestCallbacks(
			[
				{
					gadgetUri: "http://mygadget.com",
					persistenceUuid: "mustang"				
				}	
			]
		);

		let room = createRoom( "fred", "sam", callbacks );
		onRoomMessage( room, joinMessage( "julie" ) );

		expect( callbacks.outgoingMessages.length ).toBe( 1 );
		destroyLocalGadget( room, "mustang" );

		expect( callbacks.countRemoveGadget( RoomMemberIdReserved.Broadcast, "mustang" ) ).toBe( 1 );
	} );

	it( "updateGadgetToPeer", async () =>
	{
		let callbacks = new GadgetRoomTestCallbacks(
			[
				{
					gadgetUri: "http://mygadget.com",
					persistenceUuid: "mustang",
					hook: "/hooky/hook",				
				}	
			]
		);

		let room = createRoom( "fred", "sam", callbacks );
		onRoomMessage( room, joinMessage( "julie" ) );

		updateLocalGadgetHook( room, "mustang", "/grabby/hook" );

		let updateMessages = callbacks.getMessagesOfTypeAndDestination( RoomMemberIdReserved.Broadcast,
			RoomMessageTypePrivate.UpdateGadgetHook );
		expect( updateMessages.length ).toBe( 1 );
		let m = updateMessages[0] as RMUpdateGadgetHook;
		expect( m.newHook ).toBe( "/grabby/hook" );
	} );


	it( "addGadgetFromPeer", async () =>
	{
		let callbacks = new GadgetRoomTestCallbacks();

		let room = createRoom( "fred", "sam", callbacks );
		onRoomMessage( room, joinMessage( "julie" ) );

		expect( callbacks.outgoingMessages.length ).toBe( 0 );
		expect( callbacks.remoteGadgets.length ).toBe( 0 );

		onRoomMessage( room, addGadgetMessage( "julie", "http://awesomegadget.com", "camaro", 
			"/a/hook" ) );
		
		expect( callbacks.remoteGadgets.length ).toBe( 1 );
		let rg0 = callbacks.remoteGadgets[0];
		expect( rg0.gadgetUri ).toBe( "http://awesomegadget.com" );
		expect( rg0.persistenceUuid ).toBe( "camaro" );
		expect( rg0.hook ).toBe( "/a/hook" );
		expect( rg0.ownerId ).toBe( "julie" );
	} );

	it( "removeGadgetFromPeer", async () =>
	{
		let callbacks = new GadgetRoomTestCallbacks();

		let room = createRoom( "fred", "sam", callbacks );
		onRoomMessage( room, joinMessage( "julie" ) );
		onRoomMessage( room, addGadgetMessage( "julie", "http://awesomegadget.com", "camaro", 
			"/a/hook" ) );
		
		expect( callbacks.remoteGadgets.length ).toBe( 1 );
		onRoomMessage( room, removeGadgetMessage( "julie", "camaro" ) );
		expect( callbacks.remoteGadgets.length ).toBe( 0 );
	} );

	it( "updateGadgetFromPeer", async () =>
	{
		let callbacks = new GadgetRoomTestCallbacks();

		let room = createRoom( "fred", "sam", callbacks );
		onRoomMessage( room, joinMessage( "julie" ) );
		onRoomMessage( room, addGadgetMessage( "julie", "http://awesomegadget.com", "camaro", 
			"/a/hook" ) );
		
		expect( callbacks.remoteGadgets.length ).toBe( 1 );
		expect( callbacks.remoteGadgets[0].hook ).toBe( "/a/hook" );
		onRoomMessage( room, updateGadgetHookMessage( "julie", "camaro", "/b/hook" ) );
		expect( callbacks.remoteGadgets.length ).toBe( 1 );
		expect( callbacks.remoteGadgets[0].hook ).toBe( "/b/hook" );
	} );

} );



